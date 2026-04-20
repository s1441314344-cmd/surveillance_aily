from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session


def run_camera_status_sweep_once_with_db(
    *,
    db: Session,
    camera_ids: list[str] | None,
    camera_model,
    check_camera_status_fn,
    logger,
) -> dict[str, int]:
    stmt = select(camera_model).order_by(camera_model.created_at.desc(), camera_model.name.asc())
    if camera_ids:
        stmt = stmt.where(camera_model.id.in_(camera_ids))
    cameras = list(db.scalars(stmt))

    checked_count = 0
    failed_count = 0
    for camera in cameras:
        try:
            check_camera_status_fn(db, camera)
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
