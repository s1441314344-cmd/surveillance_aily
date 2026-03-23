import copy
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.models.file_asset import FileAsset
from app.models.job import Job, JobSchedule
from app.schemas.auth import CurrentUser
from app.schemas.job import JobRead
from app.services.camera_service import get_camera_or_404
from app.services.ids import generate_id
from app.services.job_schedule_service import SCHEDULE_STATUS_ACTIVE, calculate_next_run_at
from app.services.storage import FileStorageService
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404

settings = get_settings()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"
JOB_STATUS_TERMINAL = {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}
JOB_STATUS_RETRYABLE = {JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}


def serialize_job(job: Job) -> JobRead:
    return JobRead(
        id=job.id,
        job_type=job.job_type,
        trigger_mode=job.trigger_mode,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        camera_id=job.camera_id,
        schedule_id=job.schedule_id,
        model_provider=job.model_provider,
        model_name=job.model_name,
        status=job.status,
        total_items=job.total_items,
        completed_items=job.completed_items,
        failed_items=job.failed_items,
        error_message=job.error_message,
        started_at=_serialize_datetime(job.started_at),
        finished_at=_serialize_datetime(job.finished_at),
        created_at=_serialize_datetime(job.created_at),
    )


def list_jobs(
    db: Session,
    *,
    status_filter: str | None = None,
    job_type: str | None = None,
    strategy_id: str | None = None,
    trigger_mode: str | None = None,
    camera_id: str | None = None,
    schedule_id: str | None = None,
) -> list[JobRead]:
    stmt = select(Job).order_by(Job.created_at.desc(), Job.id.desc())
    if status_filter:
        stmt = stmt.where(Job.status == status_filter)
    if job_type:
        stmt = stmt.where(Job.job_type == job_type)
    if strategy_id:
        stmt = stmt.where(Job.strategy_id == strategy_id)
    if trigger_mode:
        stmt = stmt.where(Job.trigger_mode == trigger_mode)
    if camera_id:
        stmt = stmt.where(Job.camera_id == camera_id)
    if schedule_id:
        stmt = stmt.where(Job.schedule_id == schedule_id)
    return [serialize_job(job) for job in db.scalars(stmt)]


def get_job_or_404(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


def create_upload_job(
    db: Session,
    *,
    strategy_id: str,
    files: list[UploadFile],
    current_user: CurrentUser,
) -> JobRead:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one file is required")

    _validate_upload_files(files)

    strategy = get_strategy_or_404(db, strategy_id)
    strategy_snapshot = build_strategy_snapshot(strategy)
    job_id = generate_id()
    saved_assets = _save_upload_inputs(db, job_id=job_id, files=files)

    job = Job(
        id=job_id,
        job_type="upload_batch" if len(saved_assets) > 1 else "upload_single",
        trigger_mode="manual",
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        camera_id=None,
        schedule_id=None,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        status="queued",
        celery_task_id=None,
        total_items=len(saved_assets),
        completed_items=0,
        failed_items=0,
        error_message=None,
        started_at=None,
        finished_at=None,
        payload={
            "requested_by": current_user.username,
            "input_asset_ids": [asset.id for asset in saved_assets],
            "input_file_names": [asset.original_name for asset in saved_assets],
            "strategy_snapshot": strategy_snapshot,
            "source_type": "upload",
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    _queue_job_processing(db, job)
    db.refresh(job)
    return serialize_job(job)


def create_camera_once_job(
    db: Session,
    *,
    camera_id: str,
    strategy_id: str,
    current_user: CurrentUser,
    model_provider: str | None = None,
    model_name: str | None = None,
) -> JobRead:
    camera = get_camera_or_404(db, camera_id)
    strategy = get_strategy_or_404(db, strategy_id)
    strategy_snapshot = build_strategy_snapshot(strategy)
    job = _build_camera_job(
        job_id=generate_id(),
        job_type="camera_once",
        trigger_mode="manual",
        requested_by=current_user.username,
        camera=camera,
        strategy=strategy,
        strategy_snapshot=strategy_snapshot,
        model_provider=model_provider or strategy.model_provider,
        model_name=model_name or strategy.model_name,
        schedule_id=None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    _queue_job_processing(db, job)
    db.refresh(job)
    return serialize_job(job)


def create_camera_schedule_job(
    db: Session,
    *,
    schedule: JobSchedule,
    requested_by: str,
    dispatch: bool | None = None,
) -> JobRead:
    if schedule.status != SCHEDULE_STATUS_ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Schedule is not active")

    camera = get_camera_or_404(db, schedule.camera_id)
    strategy = get_strategy_or_404(db, schedule.strategy_id)
    if strategy.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Strategy is not active")

    strategy_snapshot = build_strategy_snapshot(strategy)
    current_time = _utcnow()
    job = _build_camera_job(
        job_id=generate_id(),
        job_type="camera_schedule",
        trigger_mode="schedule",
        requested_by=requested_by,
        camera=camera,
        strategy=strategy,
        strategy_snapshot=strategy_snapshot,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        schedule_id=schedule.id,
    )

    schedule.last_run_at = current_time
    schedule.next_run_at = calculate_next_run_at(schedule.schedule_type, schedule.schedule_value, current_time)
    schedule.last_error = None

    db.add(job)
    db.commit()
    db.refresh(job)
    _queue_job_processing(db, job, dispatch=dispatch)
    db.refresh(job)
    return serialize_job(job)


def cancel_job(db: Session, job: Job) -> JobRead:
    if job.status not in JOB_STATUS_TERMINAL:
        job.status = JOB_STATUS_CANCELLED
        if job.finished_at is None:
            job.finished_at = _utcnow()
        db.commit()
        db.refresh(job)
        _revoke_job_processing(job.celery_task_id)
    return serialize_job(job)


def retry_job(
    db: Session,
    *,
    source_job: Job,
    current_user: CurrentUser,
) -> JobRead:
    if source_job.status not in JOB_STATUS_RETRYABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job status {source_job.status} is not retryable",
        )

    payload = copy.deepcopy(source_job.payload or {})
    payload["requested_by"] = current_user.username
    payload["retry_of_job_id"] = source_job.id

    new_job = Job(
        id=generate_id(),
        job_type=source_job.job_type,
        trigger_mode="manual",
        strategy_id=source_job.strategy_id,
        strategy_name=source_job.strategy_name,
        camera_id=source_job.camera_id,
        schedule_id=source_job.schedule_id,
        model_provider=source_job.model_provider,
        model_name=source_job.model_name,
        status="queued",
        celery_task_id=None,
        total_items=source_job.total_items,
        completed_items=0,
        failed_items=0,
        error_message=None,
        started_at=None,
        finished_at=None,
        payload=payload,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    _queue_job_processing(db, new_job)
    db.refresh(new_job)
    return serialize_job(new_job)


def _save_upload_inputs(db: Session, *, job_id: str, files: list[UploadFile]) -> list[FileAsset]:
    storage = FileStorageService()
    assets: list[FileAsset] = []
    for file in files:
        content = file.file.read()
        storage_path = storage.save_bytes(content, file.filename or "upload.bin", folder=f"jobs/{job_id}/inputs")
        asset = FileAsset(
            id=generate_id(),
            purpose="job_input",
            original_name=file.filename or Path(storage_path).name,
            storage_path=storage_path,
            mime_type=file.content_type or "application/octet-stream",
        )
        db.add(asset)
        db.flush()
        assets.append(asset)
    return assets


def _build_camera_job(
    *,
    job_id: str,
    job_type: str,
    trigger_mode: str,
    requested_by: str,
    camera,
    strategy,
    strategy_snapshot: dict,
    model_provider: str,
    model_name: str,
    schedule_id: str | None,
) -> Job:
    return Job(
        id=job_id,
        job_type=job_type,
        trigger_mode=trigger_mode,
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        camera_id=camera.id,
        schedule_id=schedule_id,
        model_provider=model_provider,
        model_name=model_name,
        status="queued",
        celery_task_id=None,
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
        started_at=None,
        finished_at=None,
        payload={
            "requested_by": requested_by,
            "source_type": job_type,
            "strategy_snapshot": strategy_snapshot,
            "camera_snapshot": {
                "id": camera.id,
                "name": camera.name,
                "protocol": camera.protocol,
                "rtsp_url": camera.rtsp_url,
                "resolution": camera.resolution,
                "jpeg_quality": camera.jpeg_quality,
                "storage_path": camera.storage_path,
            },
        },
    )


def _queue_job_processing(db: Session, job: Job, dispatch: bool | None = None) -> None:
    should_dispatch = settings.celery_enabled if dispatch is None else dispatch
    if not should_dispatch:
        return

    try:
        from app.workers.tasks import process_job

        async_result = process_job.delay(job.id)
        job.celery_task_id = async_result.id
        db.commit()
    except Exception as exc:  # pragma: no cover - broker/runtime dependent
        job.status = JOB_STATUS_FAILED
        job.error_message = f"Queue dispatch failed: {exc}"
        job.finished_at = _utcnow()
        db.commit()


def _revoke_job_processing(celery_task_id: str | None) -> None:
    if not settings.celery_enabled or not celery_task_id:
        return

    try:  # pragma: no cover - broker/runtime dependent
        celery_app.control.revoke(celery_task_id, terminate=False)
    except Exception:
        return


def _validate_upload_files(files: list[UploadFile]) -> None:
    invalid_files: list[str] = []
    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_IMAGE_EXTENSIONS:
            invalid_files.append(file.filename or "unnamed")

    if invalid_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format: {', '.join(invalid_files)}",
        )


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat() if value.tzinfo else value.replace(tzinfo=timezone.utc).isoformat()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
