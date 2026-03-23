from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.job import JobScheduleCreate, JobScheduleRead, JobScheduleStatusUpdate, JobScheduleUpdate
from app.services.job_schedule_service import (
    delete_job_schedule as delete_job_schedule_record,
    get_job_schedule_or_404,
    list_job_schedules as list_job_schedule_records,
    update_job_schedule as update_job_schedule_record,
    update_job_schedule_status as update_job_schedule_status_record,
)
from app.services.job_schedule_service import create_job_schedule as create_job_schedule_record
from app.services.rbac import ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR

router = APIRouter()


@router.get("", response_model=list[JobScheduleRead])
def list_job_schedules(
    status: str | None = None,
    camera_id: str | None = None,
    strategy_id: str | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_job_schedule_records(
        db,
        status_filter=status,
        camera_id=camera_id,
        strategy_id=strategy_id,
    )


@router.post("", response_model=JobScheduleRead)
def create_job_schedule(
    payload: JobScheduleCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return create_job_schedule_record(db, payload)


@router.patch("/{schedule_id}", response_model=JobScheduleRead)
def update_job_schedule(
    schedule_id: str,
    payload: JobScheduleUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return update_job_schedule_record(
        db,
        get_job_schedule_or_404(db, schedule_id),
        payload,
    )


@router.patch("/{schedule_id}/status", response_model=JobScheduleRead)
def update_job_schedule_status(
    schedule_id: str,
    payload: JobScheduleStatusUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return update_job_schedule_status_record(
        db,
        get_job_schedule_or_404(db, schedule_id),
        payload.status,
    )


@router.delete("/{schedule_id}")
def delete_job_schedule(
    schedule_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return delete_job_schedule_record(db, get_job_schedule_or_404(db, schedule_id))
