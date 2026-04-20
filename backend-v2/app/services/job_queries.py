from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job
from app.schemas.job import JobRead
from app.services.job_service_support import _ensure_aware_for_db, _serialize_datetime


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
    created_from: datetime | None = None,
    created_to: datetime | None = None,
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
    if created_from:
        stmt = stmt.where(Job.created_at >= _ensure_aware_for_db(created_from))
    if created_to:
        stmt = stmt.where(Job.created_at <= _ensure_aware_for_db(created_to))
    return [serialize_job(job) for job in db.scalars(stmt)]


def get_job_or_404(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job
