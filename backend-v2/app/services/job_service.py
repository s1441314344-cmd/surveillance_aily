import time
from datetime import timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.file_asset import FileAsset
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.schemas.auth import CurrentUser
from app.schemas.job import JobRead
from app.services.ids import generate_id
from app.services.providers.base import ProviderRequest
from app.services.providers.factory import get_provider_adapter
from app.services.storage import FileStorageService
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
JOB_STATUS_TERMINAL = {"completed", "failed", "cancelled"}


def serialize_job(job: Job) -> JobRead:
    return JobRead(
        id=job.id,
        job_type=job.job_type,
        trigger_mode=job.trigger_mode,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        camera_id=job.camera_id,
        model_provider=job.model_provider,
        model_name=job.model_name,
        status=job.status,
        total_items=job.total_items,
        completed_items=job.completed_items,
        failed_items=job.failed_items,
        error_message=job.error_message,
        created_at=job.created_at.astimezone(timezone.utc).isoformat() if job.created_at else None,
    )


def list_jobs(
    db: Session,
    *,
    status_filter: str | None = None,
    job_type: str | None = None,
    strategy_id: str | None = None,
) -> list[JobRead]:
    stmt = select(Job).order_by(Job.created_at.desc(), Job.id.desc())
    if status_filter:
        stmt = stmt.where(Job.status == status_filter)
    if job_type:
        stmt = stmt.where(Job.job_type == job_type)
    if strategy_id:
        stmt = stmt.where(Job.strategy_id == strategy_id)
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
    job = Job(
        id=generate_id(),
        job_type="upload_batch" if len(files) > 1 else "upload_single",
        trigger_mode="manual",
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        camera_id=None,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        status="queued",
        total_items=len(files),
        completed_items=0,
        failed_items=0,
        error_message=None,
        payload={
            "file_names": [file.filename or "unnamed" for file in files],
            "requested_by": current_user.username,
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    _process_upload_job_inline(db, job, files, strategy_snapshot)
    db.refresh(job)
    return serialize_job(job)


def cancel_job(db: Session, job: Job) -> JobRead:
    if job.status not in JOB_STATUS_TERMINAL:
        job.status = "cancelled"
        db.commit()
        db.refresh(job)
    return serialize_job(job)


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


def _process_upload_job_inline(db: Session, job: Job, files: list[UploadFile], strategy_snapshot: dict) -> None:
    storage = FileStorageService()
    adapter = get_provider_adapter(job.model_provider)

    job.status = "running"
    db.commit()

    for file in files:
        started_at = time.perf_counter()
        content = file.file.read()
        if not content:
            _create_failed_task_record(
                db,
                job=job,
                strategy_snapshot=strategy_snapshot,
                file=file,
                error_message="Uploaded file is empty",
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )
            continue

        storage_path = storage.save_bytes(content, file.filename or "upload.bin", folder=f"jobs/{job.id}")
        file_asset = FileAsset(
            id=generate_id(),
            purpose="job_input",
            original_name=file.filename or Path(storage_path).name,
            storage_path=storage_path,
            mime_type=file.content_type or "application/octet-stream",
        )
        db.add(file_asset)
        db.flush()

        provider_response = adapter.analyze(
            ProviderRequest(
                model=job.model_name,
                prompt=strategy_snapshot["prompt_template"],
                image_paths=[storage_path],
                response_schema=strategy_snapshot["response_schema"],
            )
        )
        duration_ms = int((time.perf_counter() - started_at) * 1000)

        task_record = TaskRecord(
            id=generate_id(),
            job_id=job.id,
            strategy_id=job.strategy_id,
            strategy_name=job.strategy_name,
            strategy_snapshot=strategy_snapshot,
            input_file_asset_id=file_asset.id,
            input_filename=file_asset.original_name,
            input_image_path=storage_path,
            preview_image_path=None,
            source_type="upload",
            camera_id=None,
            model_provider=job.model_provider,
            model_name=job.model_name,
            raw_model_response=provider_response.raw_response or "",
            normalized_json=provider_response.normalized_json,
            result_status="completed" if provider_response.success else "failed",
            duration_ms=duration_ms,
            feedback_status="unreviewed",
        )
        db.add(task_record)

        if provider_response.success:
            job.completed_items += 1
        else:
            job.failed_items += 1
            if not job.error_message:
                job.error_message = provider_response.error_message

    if job.failed_items > 0:
        job.status = "failed" if job.completed_items == 0 else "completed"
    else:
        job.status = "completed"

    db.commit()


def _create_failed_task_record(
    db: Session,
    *,
    job: Job,
    strategy_snapshot: dict,
    file: UploadFile,
    error_message: str,
    duration_ms: int,
) -> None:
    task_record = TaskRecord(
        id=generate_id(),
        job_id=job.id,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        strategy_snapshot=strategy_snapshot,
        input_file_asset_id=None,
        input_filename=file.filename or "unnamed",
        input_image_path="",
        preview_image_path=None,
        source_type="upload",
        camera_id=None,
        model_provider=job.model_provider,
        model_name=job.model_name,
        raw_model_response=error_message,
        normalized_json=None,
        result_status="failed",
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)
    job.failed_items += 1
    if not job.error_message:
        job.error_message = error_message
