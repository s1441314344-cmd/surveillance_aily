import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.camera import Camera
from app.models.camera_media import CameraMedia
from app.models.file_asset import FileAsset
from app.schemas.camera import (
    CameraMediaRead,
    CameraPhotoCaptureRead,
    CameraRecordingStatusRead,
)
from app.services.camera_capture_service import (
    CameraCaptureError,
    build_media_filename,
    build_recording_plan,
    capture_camera_frame,
)
from app.services.ids import generate_id
from app.services.storage import ensure_storage_root

RECORDING_STATUS_RECORDING = "recording"
RECORDING_STATUS_COMPLETED = "completed"
RECORDING_STATUS_FAILED = "failed"
RECORDING_STATUS_STOPPED = "stopped"

_recording_lock = threading.Lock()
_recording_processes: dict[str, subprocess.Popen] = {}


def serialize_camera_media(media: CameraMedia) -> CameraMediaRead:
    return CameraMediaRead(
        id=media.id,
        camera_id=media.camera_id,
        related_job_id=media.related_job_id,
        file_asset_id=media.file_asset_id,
        media_type=media.media_type,
        source_kind=media.source_kind,
        status=media.status,
        original_name=media.original_name,
        storage_path=media.storage_path,
        mime_type=media.mime_type,
        duration_seconds=media.duration_seconds,
        stop_requested=media.stop_requested,
        started_at=_serialize_datetime(media.started_at),
        finished_at=_serialize_datetime(media.finished_at),
        error_message=media.error_message,
        created_at=_serialize_datetime(media.created_at),
        updated_at=_serialize_datetime(media.updated_at),
    )


def list_camera_media(
    db: Session,
    *,
    camera_id: str,
    media_type: str | None = None,
    limit: int = 50,
) -> list[CameraMediaRead]:
    safe_limit = min(max(limit, 1), 200)
    # Camera center media panel should only contain user-triggered photo/video files.
    stmt = (
        select(CameraMedia)
        .where(CameraMedia.camera_id == camera_id)
        .where(CameraMedia.related_job_id.is_(None))
        .order_by(CameraMedia.created_at.desc())
    )
    if media_type:
        stmt = stmt.where(CameraMedia.media_type == media_type)
    stmt = stmt.limit(safe_limit)
    return [serialize_camera_media(row) for row in db.scalars(stmt)]


def get_camera_media_or_404(db: Session, *, camera_id: str, media_id: str) -> CameraMedia:
    media = db.get(CameraMedia, media_id)
    if media is None or media.camera_id != camera_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera media not found")
    return media


def get_camera_media_file_path_or_404(media: CameraMedia) -> str:
    file_path = Path(media.storage_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera media file not found")
    return str(file_path)


def capture_photo(
    db: Session,
    *,
    camera: Camera,
    source_kind: str = "manual",
) -> CameraPhotoCaptureRead:
    now = _utcnow()
    try:
        frame = capture_camera_frame(camera)
    except CameraCaptureError as exc:
        return CameraPhotoCaptureRead(camera_id=camera.id, success=False, media=None, error_message=str(exc))

    extension = "png" if frame.mime_type == "image/png" else "jpg"
    file_name = build_media_filename(
        camera_name=camera.name,
        camera_id=camera.id,
        media_kind="photo",
        extension=extension,
        timestamp=now,
    )
    storage_path = _build_media_path(camera, media_type="photo", file_name=file_name, timestamp=now)
    Path(storage_path).write_bytes(frame.content)

    file_asset = FileAsset(
        id=generate_id(),
        purpose="camera_photo",
        original_name=file_name,
        storage_path=storage_path,
        mime_type=frame.mime_type,
    )
    media = CameraMedia(
        id=generate_id(),
        camera_id=camera.id,
        related_job_id=None,
        file_asset_id=file_asset.id,
        media_type="photo",
        source_kind=source_kind,
        status=RECORDING_STATUS_COMPLETED,
        original_name=file_name,
        storage_path=storage_path,
        mime_type=frame.mime_type,
        duration_seconds=0,
        stop_requested=False,
        started_at=now,
        finished_at=now,
        error_message=None,
    )
    db.add(file_asset)
    db.add(media)
    db.commit()
    db.refresh(media)
    return CameraPhotoCaptureRead(camera_id=camera.id, success=True, media=serialize_camera_media(media), error_message=None)


def start_video_recording(
    db: Session,
    *,
    camera: Camera,
    duration_seconds: int,
    source_kind: str = "manual",
) -> CameraRecordingStatusRead:
    safe_duration = min(max(duration_seconds, 3), 3600)
    _ensure_camera_has_no_active_recording(db, camera_id=camera.id)

    now = _utcnow()
    file_name = build_media_filename(
        camera_name=camera.name,
        camera_id=camera.id,
        media_kind="video",
        extension="mp4",
        timestamp=now,
    )
    output_path = _build_media_path(camera, media_type="video", file_name=file_name, timestamp=now)
    recording_plan = build_recording_plan(
        camera,
        output_path=output_path,
        file_name=file_name,
        duration_seconds=safe_duration,
    )

    file_asset = FileAsset(
        id=generate_id(),
        purpose="camera_video",
        original_name=file_name,
        storage_path=recording_plan.output_path,
        mime_type=recording_plan.mime_type,
    )
    media = CameraMedia(
        id=generate_id(),
        camera_id=camera.id,
        related_job_id=None,
        file_asset_id=file_asset.id,
        media_type="video",
        source_kind=source_kind,
        status=RECORDING_STATUS_RECORDING,
        original_name=file_name,
        storage_path=recording_plan.output_path,
        mime_type=recording_plan.mime_type,
        duration_seconds=safe_duration,
        stop_requested=False,
        started_at=now,
        finished_at=None,
        error_message=None,
    )
    db.add(file_asset)
    db.add(media)
    db.commit()
    db.refresh(media)

    try:
        process = subprocess.Popen(
            recording_plan.command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except Exception as exc:
        media.status = RECORDING_STATUS_FAILED
        media.finished_at = _utcnow()
        media.error_message = f"Unable to start ffmpeg recording: {exc}"
        db.commit()
        db.refresh(media)
        return CameraRecordingStatusRead(
            camera_id=camera.id,
            success=False,
            media=serialize_camera_media(media),
            message="录制启动失败",
        )

    with _recording_lock:
        _recording_processes[media.id] = process

    monitor = threading.Thread(
        target=_monitor_recording_completion,
        args=(media.id, process),
        daemon=True,
        name=f"camera-recording-{media.id[:8]}",
    )
    monitor.start()

    return CameraRecordingStatusRead(
        camera_id=camera.id,
        success=True,
        media=serialize_camera_media(media),
        message="录制已启动",
    )


def stop_video_recording(
    db: Session,
    *,
    media: CameraMedia,
) -> CameraRecordingStatusRead:
    if media.media_type != "video":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only video recording can be stopped")

    if media.status != RECORDING_STATUS_RECORDING:
        return CameraRecordingStatusRead(
            camera_id=media.camera_id,
            success=False,
            media=serialize_camera_media(media),
            message="当前录制状态不可停止",
        )

    media.stop_requested = True
    db.commit()
    db.refresh(media)

    process: subprocess.Popen | None
    with _recording_lock:
        process = _recording_processes.get(media.id)

    if process is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except Exception:
            process.kill()

    db.expire_all()
    refreshed = db.get(CameraMedia, media.id) or media
    return CameraRecordingStatusRead(
        camera_id=refreshed.camera_id,
        success=True,
        media=serialize_camera_media(refreshed),
        message="已发送停止录制请求",
    )


def delete_camera_media(
    db: Session,
    *,
    media: CameraMedia,
) -> dict[str, bool]:
    if media.status == RECORDING_STATUS_RECORDING:
        process: subprocess.Popen | None
        with _recording_lock:
            process = _recording_processes.get(media.id)
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except Exception:
                process.kill()

    storage_path = Path(media.storage_path)
    if storage_path.exists() and storage_path.is_file():
        try:
            storage_path.unlink()
        except OSError:
            # Keep DB cleanup best-effort even if filesystem deletion fails.
            pass

    if media.file_asset_id:
        file_asset = db.get(FileAsset, media.file_asset_id)
        if file_asset is not None:
            db.delete(file_asset)

    db.delete(media)
    db.commit()
    return {"deleted": True}


def _ensure_camera_has_no_active_recording(db: Session, *, camera_id: str) -> None:
    stmt = (
        select(CameraMedia)
        .where(CameraMedia.camera_id == camera_id)
        .where(CameraMedia.media_type == "video")
        .where(CameraMedia.status == RECORDING_STATUS_RECORDING)
        .order_by(CameraMedia.created_at.desc())
    )
    existing = db.scalar(stmt)
    if existing is None:
        return
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该摄像头已有正在进行的视频录制任务")


def _monitor_recording_completion(media_id: str, process: subprocess.Popen) -> None:
    raw_error = ""
    try:
        _, stderr = process.communicate()
        if stderr:
            raw_error = stderr.decode("utf-8", errors="ignore")
    except Exception as exc:  # pragma: no cover - defensive
        raw_error = str(exc)
    finally:
        with _recording_lock:
            _recording_processes.pop(media_id, None)

    with SessionLocal() as db:
        media = db.get(CameraMedia, media_id)
        if media is None:
            return

        media.finished_at = _utcnow()
        output_exists = Path(media.storage_path).exists() and Path(media.storage_path).stat().st_size > 0
        if media.stop_requested:
            media.status = RECORDING_STATUS_STOPPED if output_exists else RECORDING_STATUS_FAILED
            media.error_message = None if output_exists else "录制被停止且未生成有效视频文件"
        elif process.returncode == 0 and output_exists:
            media.status = RECORDING_STATUS_COMPLETED
            media.error_message = None
        else:
            media.status = RECORDING_STATUS_FAILED
            trimmed_error = raw_error.strip()
            media.error_message = trimmed_error[-400:] if trimmed_error else "ffmpeg recording failed"

        db.commit()


def _build_media_path(camera: Camera, *, media_type: str, file_name: str, timestamp: datetime) -> str:
    root = Path(ensure_storage_root(camera.storage_path))
    date_folder = timestamp.astimezone(timezone.utc).strftime("%Y%m%d")
    media_folder = "photos" if media_type == "photo" else "videos"
    target = root / "camera-media" / camera.id / media_folder / date_folder / file_name
    target.parent.mkdir(parents=True, exist_ok=True)
    return str(target)


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.astimezone(timezone.utc).isoformat()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
