import copy

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.services.ids import generate_id
from app.models.job import Job
from app.schemas.auth import CurrentUser
from app.schemas.job import JobRead
from app.services.job_queries import get_job_or_404, serialize_job
from app.services.job_service_support import (
    JOB_STATUS_CANCELLED,
    JOB_STATUS_RETRYABLE,
    JOB_STATUS_TERMINAL,
    _queue_job_processing,
    _revoke_job_processing,
    _utcnow,
)


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


def run_job_inline(db: Session, *, job: Job) -> JobRead:
    from app.services.job_execution_service import process_job as process_job_now

    process_job_now(job.id)
    db.expire_all()
    refreshed_job = get_job_or_404(db, job.id)
    return serialize_job(refreshed_job)
