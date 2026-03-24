import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.camera import Camera
from app.models.job import JobSchedule
from app.services.camera_service import check_camera_status
from app.services.job_schedule_service import calculate_next_run_at
from app.services.job_service import create_camera_schedule_job

logger = logging.getLogger(__name__)


def run_due_job_schedules_once(
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    with SessionLocal() as db:
        return run_due_job_schedules_once_with_db(db, now=now, dispatch_jobs=dispatch_jobs)


def run_due_job_schedules_once_with_db(
    db: Session,
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    current_time = _ensure_aware(now or datetime.now(timezone.utc))
    stmt = (
        select(JobSchedule)
        .where(JobSchedule.status == "active")
        .where(JobSchedule.next_run_at.is_not(None))
        .where(JobSchedule.next_run_at <= current_time)
        .order_by(JobSchedule.next_run_at.asc(), JobSchedule.id.asc())
    )
    schedules = list(db.scalars(stmt))
    created_job_ids: list[str] = []

    for schedule in schedules:
        try:
            job = create_camera_schedule_job(
                db,
                schedule=schedule,
                requested_by="scheduler",
                dispatch=dispatch_jobs,
            )
            created_job_ids.append(job.id)
            if job.status == "failed" and job.error_message:
                persisted_schedule = db.get(JobSchedule, schedule.id)
                if persisted_schedule is not None:
                    persisted_schedule.last_error = job.error_message
                    db.commit()
        except Exception as exc:
            persisted_schedule = db.get(JobSchedule, schedule.id)
            if persisted_schedule is None:
                continue
            persisted_schedule.last_run_at = current_time
            persisted_schedule.next_run_at = calculate_next_run_at(
                persisted_schedule.schedule_type,
                persisted_schedule.schedule_value,
                current_time,
            )
            persisted_schedule.last_error = str(exc)
            db.commit()

    return created_job_ids


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


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
