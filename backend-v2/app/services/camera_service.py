from datetime import timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import encrypt_secret
from app.services.camera_capture_service import diagnose_camera_capture
from app.models.camera import Camera, CameraStatusLog
from app.schemas.camera import (
    CameraCreate,
    CameraDiagnosticRead,
    CameraRead,
    CameraStatusLogRead,
    CameraStatusRead,
    CameraUpdate,
)
from app.services.ids import generate_id
from app.services.storage import ensure_storage_root


def serialize_camera(camera: Camera) -> CameraRead:
    return CameraRead(
        id=camera.id,
        name=camera.name,
        location=camera.location,
        ip_address=camera.ip_address,
        port=camera.port,
        protocol=camera.protocol,
        username=camera.username,
        rtsp_url=camera.rtsp_url,
        frame_frequency_seconds=camera.frame_frequency_seconds,
        resolution=camera.resolution,
        jpeg_quality=camera.jpeg_quality,
        storage_path=camera.storage_path,
        has_password=bool(camera.password_encrypted),
    )


def serialize_camera_status(status_log: CameraStatusLog | None, camera_id: str) -> CameraStatusRead:
    if status_log is None:
        return CameraStatusRead(
            camera_id=camera_id,
            connection_status="unknown",
            alert_status="normal",
            last_error=None,
            last_checked_at=None,
        )

    return CameraStatusRead(
        camera_id=camera_id,
        connection_status=status_log.connection_status,
        alert_status=status_log.alert_status,
        last_error=status_log.last_error,
        last_checked_at=(
            status_log.created_at.astimezone(timezone.utc).isoformat()
            if status_log.created_at is not None
            else None
        ),
    )


def serialize_camera_status_log(status_log: CameraStatusLog) -> CameraStatusLogRead:
    return CameraStatusLogRead(
        id=status_log.id,
        camera_id=status_log.camera_id,
        connection_status=status_log.connection_status,
        alert_status=status_log.alert_status,
        last_error=status_log.last_error,
        created_at=status_log.created_at.astimezone(timezone.utc).isoformat(),
    )


def serialize_camera_diagnostic(diagnostic) -> CameraDiagnosticRead:
    return CameraDiagnosticRead(
        camera_id=diagnostic.camera_id,
        camera_name=diagnostic.camera_name,
        protocol=diagnostic.protocol,
        stream_url_masked=diagnostic.stream_url_masked,
        success=diagnostic.success,
        capture_mode=diagnostic.capture_mode,
        latency_ms=diagnostic.latency_ms,
        frame_size_bytes=diagnostic.frame_size_bytes,
        mime_type=diagnostic.mime_type,
        width=diagnostic.width,
        height=diagnostic.height,
        snapshot_path=diagnostic.snapshot_path,
        error_message=diagnostic.error_message,
        checked_at=diagnostic.checked_at.astimezone(timezone.utc).isoformat(),
    )


def list_cameras(db: Session) -> list[CameraRead]:
    cameras = list(db.scalars(select(Camera).order_by(Camera.created_at.desc(), Camera.name.asc())))
    return [serialize_camera(camera) for camera in cameras]


def get_camera_or_404(db: Session, camera_id: str) -> Camera:
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return camera


def create_camera(db: Session, payload: CameraCreate) -> CameraRead:
    ensure_storage_root(payload.storage_path)

    camera = Camera(
        id=generate_id(),
        name=payload.name,
        location=payload.location,
        ip_address=payload.ip_address,
        port=payload.port,
        protocol=payload.protocol,
        username=payload.username,
        password_encrypted=encrypt_secret(payload.password),
        rtsp_url=payload.rtsp_url,
        frame_frequency_seconds=payload.frame_frequency_seconds,
        resolution=payload.resolution,
        jpeg_quality=payload.jpeg_quality,
        storage_path=payload.storage_path,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return serialize_camera(camera)


def update_camera(db: Session, camera: Camera, payload: CameraUpdate) -> CameraRead:
    updates = payload.model_dump(exclude_unset=True)
    if "storage_path" in updates and updates["storage_path"] is not None:
        ensure_storage_root(updates["storage_path"])

    for field_name, value in updates.items():
        if field_name == "password":
            if value is not None:
                camera.password_encrypted = encrypt_secret(value)
            continue
        setattr(camera, field_name, value)

    db.commit()
    db.refresh(camera)
    return serialize_camera(camera)


def delete_camera(db: Session, camera: Camera) -> dict[str, bool]:
    db.execute(delete(CameraStatusLog).where(CameraStatusLog.camera_id == camera.id))
    db.delete(camera)
    db.commit()
    return {"deleted": True}


def get_latest_camera_status_log(db: Session, camera_id: str) -> CameraStatusLog | None:
    stmt = (
        select(CameraStatusLog)
        .where(CameraStatusLog.camera_id == camera_id)
        .order_by(CameraStatusLog.created_at.desc(), CameraStatusLog.id.desc())
    )
    return db.scalar(stmt)


def get_camera_status(db: Session, camera: Camera) -> CameraStatusRead:
    return serialize_camera_status(get_latest_camera_status_log(db, camera.id), camera.id)


def list_camera_status_logs(
    db: Session,
    *,
    camera_id: str,
    limit: int = 20,
) -> list[CameraStatusLogRead]:
    safe_limit = min(max(limit, 1), 100)
    stmt = (
        select(CameraStatusLog)
        .where(CameraStatusLog.camera_id == camera_id)
        .order_by(CameraStatusLog.created_at.desc(), CameraStatusLog.id.desc())
        .limit(safe_limit)
    )
    return [serialize_camera_status_log(item) for item in db.scalars(stmt)]


def list_camera_statuses(
    db: Session,
    *,
    camera_ids: list[str] | None = None,
    alert_only: bool = False,
) -> list[CameraStatusRead]:
    camera_stmt = select(Camera).order_by(Camera.created_at.desc(), Camera.name.asc())
    if camera_ids:
        camera_stmt = camera_stmt.where(Camera.id.in_(camera_ids))
    cameras = list(db.scalars(camera_stmt))
    if not cameras:
        return []

    camera_id_list = [camera.id for camera in cameras]
    status_stmt = (
        select(CameraStatusLog)
        .where(CameraStatusLog.camera_id.in_(camera_id_list))
        .order_by(CameraStatusLog.camera_id.asc(), CameraStatusLog.created_at.desc(), CameraStatusLog.id.desc())
    )
    status_map: dict[str, CameraStatusLog] = {}
    for status_log in db.scalars(status_stmt):
        status_map.setdefault(status_log.camera_id, status_log)

    serialized_statuses = [serialize_camera_status(status_map.get(camera.id), camera.id) for camera in cameras]
    if not alert_only:
        return serialized_statuses
    return [item for item in serialized_statuses if item.alert_status != "normal"]


def check_camera_status(db: Session, camera: Camera) -> CameraStatusRead:
    connection_status, alert_status, last_error = _evaluate_camera_status(camera)
    status_log = CameraStatusLog(
        id=generate_id(),
        camera_id=camera.id,
        connection_status=connection_status,
        alert_status=alert_status,
        last_error=last_error,
    )
    db.add(status_log)
    db.commit()
    db.refresh(status_log)
    return serialize_camera_status(status_log, camera.id)


def diagnose_camera(db: Session, camera: Camera, *, save_snapshot: bool = True) -> CameraDiagnosticRead:
    diagnostic = diagnose_camera_capture(camera, save_snapshot=save_snapshot)
    status_log = CameraStatusLog(
        id=generate_id(),
        camera_id=camera.id,
        connection_status="online" if diagnostic.success else "offline",
        alert_status="normal" if diagnostic.success else "error",
        last_error=diagnostic.error_message,
    )
    db.add(status_log)
    db.commit()
    return serialize_camera_diagnostic(diagnostic)


def _evaluate_camera_status(camera: Camera) -> tuple[str, str, str | None]:
    protocol = (camera.protocol or "").lower()
    if protocol != "rtsp":
        return (
            "warning",
            "warning",
            "Only RTSP protocol is supported in V1 status checks",
        )

    if not camera.rtsp_url:
        return (
            "warning",
            "warning",
            "RTSP URL is missing",
        )

    if not camera.rtsp_url.startswith("rtsp://"):
        return (
            "offline",
            "error",
            "RTSP URL must start with rtsp://",
        )

    if camera.port is not None and camera.port <= 0:
        return (
            "offline",
            "error",
            "Port must be greater than 0",
        )

    if camera.frame_frequency_seconds <= 0:
        return (
            "warning",
            "warning",
            "Frame frequency should be greater than 0",
        )

    return ("online", "normal", None)
