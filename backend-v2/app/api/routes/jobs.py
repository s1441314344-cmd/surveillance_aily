from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.job import JobCameraOnceCreate, JobRead, JobUploadCreateResponse
from app.services.job_service import cancel_job as cancel_job_record
from app.services.job_service import create_upload_job as create_upload_job_record
from app.services.job_service import get_job_or_404, list_jobs as list_job_records, serialize_job
from app.services.rbac import ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR

router = APIRouter()


@router.post("/uploads", response_model=JobRead)
def create_upload_job(
    strategy_id: Annotated[str, Form(...)],
    files: Annotated[list[UploadFile], File(...)],
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return create_upload_job_record(db, strategy_id=strategy_id, files=files, current_user=current_user)


@router.post("/cameras/once", response_model=JobRead)
def create_camera_once_job(
    payload: JobCameraOnceCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
):
    return JobRead(
        id="job-camera-once-placeholder",
        job_type="camera_once",
        trigger_mode="manual",
        strategy_id=payload.strategy_id,
        strategy_name="摄像头单次任务待实现",
        camera_id=payload.camera_id,
        model_provider=payload.model_provider or "zhipu",
        model_name=payload.model_name or "glm-4v-plus",
        status="queued",
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
        created_at=None,
    )


@router.get("", response_model=list[JobRead])
def list_jobs(
    status: str | None = None,
    job_type: str | None = None,
    strategy_id: str | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_job_records(db, status_filter=status, job_type=job_type, strategy_id=strategy_id)


@router.get("/{job_id}", response_model=JobRead)
def get_job(
    job_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_job(get_job_or_404(db, job_id))


@router.post("/{job_id}/cancel", response_model=JobRead)
def cancel_job(
    job_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return cancel_job_record(db, get_job_or_404(db, job_id))
