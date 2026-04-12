import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.camera import Camera
from app.services.camera_service import check_camera_status


logger = logging.getLogger(__name__)


def run_camera_status_sweep_once(
    *,
    camera_ids: list[str] | None = None,
) -> dict[str, int]:
    with SessionLocal() as db:
        return run_camera_status_sweep_once_with_db(db, camera_ids=camera_ids)


def run_camera_status_sweep_once_with_db(
    db: Session,
    *,
    camera_ids: list[str] | None = None,
) -> dict[str, int]:
    stmt = select(Camera).order_by(Camera.created_at.desc(), Camera.name.asc())
    if camera_ids:
        stmt = stmt.where(Camera.id.in_(camera_ids))
    cameras = list(db.scalars(stmt))

    checked_count = 0
    failed_count = 0
    for camera in cameras:
        try:
            check_camera_status(db, camera)
            checked_count += 1
        except Exception as exc:
            db.rollback()
            failed_count += 1
            logger.warning("camera status sweep failed for camera_id=%s: %s", camera.id, exc)

    return {
        "checked_count": checked_count,
        "failed_count": failed_count,
        "total_count": len(cameras),
    }
