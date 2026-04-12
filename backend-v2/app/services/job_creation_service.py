from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.file_asset import FileAsset
from app.models.job import Job, JobSchedule
from app.schemas.auth import CurrentUser
from app.schemas.job import JobRead
from app.services.camera_media_service import capture_photo as capture_camera_photo_record
from app.services.camera_service import get_camera_or_404
from app.services.ids import generate_id
from app.services.job_queries import serialize_job
from app.services.job_schedule_service import SCHEDULE_STATUS_ACTIVE, calculate_next_run_at
from app.services.job_service_support import (
    VERSION_RECOGNITION_MODEL_NAME,
    VERSION_RECOGNITION_MODEL_PROVIDER,
    VERSION_RECOGNITION_STRATEGY_ID,
    _build_camera_job,
    _build_upload_job_from_assets,
    _link_camera_media_to_job,
    _queue_job_processing,
    _resolve_camera_analysis_roi_snapshot,
    _save_upload_inputs,
    _utcnow,
    _validate_upload_files,
)
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404


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
    job = _build_upload_job_from_assets(
        job_id=job_id,
        requested_by=current_user.username,
        strategy=strategy,
        strategy_snapshot=strategy_snapshot,
        assets=saved_assets,
        camera_id=None,
        source_type="upload",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    _queue_job_processing(db, job)
    db.refresh(job)
    return serialize_job(job)


def create_version_recognition_upload_job(
    db: Session,
    *,
    file: UploadFile,
    current_user: CurrentUser,
) -> JobRead:
    _validate_upload_files([file])

    strategy = get_strategy_or_404(db, VERSION_RECOGNITION_STRATEGY_ID)
    strategy_snapshot = build_strategy_snapshot(strategy)
    job_id = generate_id()
    saved_assets = _save_upload_inputs(db, job_id=job_id, files=[file])
    asset = saved_assets[0]
    job = Job(
        id=job_id,
        job_type="version_recognition_upload",
        trigger_mode="manual",
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        camera_id=None,
        schedule_id=None,
        model_provider=VERSION_RECOGNITION_MODEL_PROVIDER,
        model_name=VERSION_RECOGNITION_MODEL_NAME,
        status="queued",
        celery_task_id=None,
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
        started_at=None,
        finished_at=None,
        payload={
            "requested_by": current_user.username,
            "input_asset_ids": [asset.id],
            "input_file_names": [asset.original_name],
            "strategy_snapshot": strategy_snapshot,
            "source_type": "upload",
            "template_key": "default-version-template",
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    _queue_job_processing(db, job)
    db.refresh(job)
    return serialize_job(job)


def create_camera_snapshot_upload_job(
    db: Session,
    *,
    camera_id: str,
    strategy_id: str,
    current_user: CurrentUser,
) -> JobRead:
    camera = get_camera_or_404(db, camera_id)
    strategy = get_strategy_or_404(db, strategy_id)
    strategy_snapshot = build_strategy_snapshot(strategy)
    capture_result = capture_camera_photo_record(db, camera=camera, source_kind="job_upload")
    if not capture_result.success or capture_result.media is None or not capture_result.media.file_asset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=capture_result.error_message or "Camera snapshot capture failed",
        )

    input_asset = db.get(FileAsset, capture_result.media.file_asset_id)
    if input_asset is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Captured asset not found")

    job_id = generate_id()
    job = _build_upload_job_from_assets(
        job_id=job_id,
        requested_by=current_user.username,
        strategy=strategy,
        strategy_snapshot=strategy_snapshot,
        assets=[input_asset],
        camera_id=camera.id,
        source_type="upload_camera_snapshot",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    _link_camera_media_to_job(
        db,
        camera_id=camera.id,
        file_asset_id=input_asset.id,
        job_id=job.id,
    )
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
        analysis_roi=_resolve_camera_analysis_roi_snapshot(db, camera_id=camera.id),
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
        analysis_roi=_resolve_camera_analysis_roi_snapshot(db, camera_id=camera.id),
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
