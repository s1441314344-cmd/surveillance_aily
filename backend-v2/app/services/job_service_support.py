import io
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.core.database import database_url
from app.models.camera_media import CameraMedia
from app.models.file_asset import FileAsset
from app.models.job import Job
from app.services.camera_roi_service import extract_analysis_roi
from app.services.camera_signal_monitor_service import get_camera_signal_monitor_config_or_create
from app.services.ids import generate_id
from app.services.storage import FileStorageService
from app.services.task_dispatcher import dispatch_job_processing


settings = get_settings()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/bmp", "image/webp"}
JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"
JOB_STATUS_TERMINAL = {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}
JOB_STATUS_RETRYABLE = {JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}
VERSION_RECOGNITION_STRATEGY_ID = "preset-version-recognition"
VERSION_RECOGNITION_MODEL_PROVIDER = "ocr_service"
VERSION_RECOGNITION_MODEL_NAME = "paddleocr-http-v1"


def _save_upload_inputs(db: Session, *, job_id: str, files: list[UploadFile]) -> list[FileAsset]:
    storage = FileStorageService()
    assets: list[FileAsset] = []
    for file in files:
        content = file.file.read()
        normalized_name, normalized_content, normalized_mime = _normalize_uploaded_image(
            filename=file.filename or "upload.bin",
            content=content,
            content_type=file.content_type or "application/octet-stream",
        )
        storage_path = storage.save_bytes(normalized_content, normalized_name, folder=f"jobs/{job_id}/inputs")
        asset = FileAsset(
            id=generate_id(),
            purpose="job_input",
            original_name=normalized_name,
            storage_path=storage_path,
            mime_type=normalized_mime,
        )
        db.add(asset)
        db.flush()
        assets.append(asset)
    return assets


def _normalize_uploaded_image(*, filename: str, content: bytes, content_type: str) -> tuple[str, bytes, str]:
    name = filename or "upload.bin"
    stem = Path(name).stem or "upload"

    try:
        with Image.open(io.BytesIO(content)) as image:
            converted = image.convert("RGB")
            output = io.BytesIO()
            converted.save(output, format="PNG")
        return f"{stem}.png", output.getvalue(), "image/png"
    except (UnidentifiedImageError, OSError, ValueError):
        # Backward-compatible fallback for non-image payloads in existing tests/legacy data.
        return name, content, content_type


def _build_upload_job_from_assets(
    *,
    job_id: str,
    requested_by: str,
    strategy,
    strategy_snapshot: dict,
    assets: list[FileAsset],
    camera_id: str | None,
    source_type: str,
) -> Job:
    return Job(
        id=job_id,
        job_type="upload_batch" if len(assets) > 1 else "upload_single",
        trigger_mode="manual",
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        camera_id=camera_id,
        schedule_id=None,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        status="queued",
        celery_task_id=None,
        total_items=len(assets),
        completed_items=0,
        failed_items=0,
        error_message=None,
        started_at=None,
        finished_at=None,
        payload={
            "requested_by": requested_by,
            "input_asset_ids": [asset.id for asset in assets],
            "input_file_names": [asset.original_name for asset in assets],
            "strategy_snapshot": strategy_snapshot,
            "source_type": source_type,
        },
    )


def _link_camera_media_to_job(db: Session, *, camera_id: str, file_asset_id: str, job_id: str) -> None:
    stmt = (
        select(CameraMedia)
        .where(CameraMedia.camera_id == camera_id)
        .where(CameraMedia.file_asset_id == file_asset_id)
        .order_by(CameraMedia.created_at.desc())
    )
    media = db.scalar(stmt)
    if media is None:
        return
    media.related_job_id = job_id
    db.commit()


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
    analysis_roi: dict | None,
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
                "analysis_roi": analysis_roi,
            },
        },
    )


def _resolve_camera_analysis_roi_snapshot(db: Session, *, camera_id: str) -> dict | None:
    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    return extract_analysis_roi(config)


def _queue_job_processing(db: Session, job: Job, dispatch: bool | None = None) -> None:
    should_dispatch = settings.celery_enabled if dispatch is None else dispatch
    if not should_dispatch:
        return

    try:
        job.celery_task_id = dispatch_job_processing(job_id=job.id)
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
    invalid_content_types: list[str] = []
    empty_files: list[str] = []

    for file in files:
        filename = file.filename or "unnamed"
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_IMAGE_EXTENSIONS:
            invalid_files.append(filename)

        content_type = (file.content_type or "").lower().strip()
        if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
            invalid_content_types.append(f"{filename}({content_type})")

        stream_position = file.file.tell()
        first_byte = file.file.read(1)
        file.file.seek(stream_position)
        if first_byte == b"":
            empty_files.append(filename)

    errors: list[str] = []
    if invalid_files:
        errors.append(f"Unsupported file format: {', '.join(invalid_files)}")
    if invalid_content_types:
        errors.append(f"Unsupported content type: {', '.join(invalid_content_types)}")
    if empty_files:
        errors.append(f"Empty file is not allowed: {', '.join(empty_files)}")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors),
        )


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat() if value.tzinfo else value.replace(tzinfo=timezone.utc).isoformat()


def _ensure_aware_for_db(value: datetime) -> datetime:
    normalized = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if database_url.get_backend_name().startswith("sqlite"):
        return normalized.replace(tzinfo=None)
    return normalized


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
