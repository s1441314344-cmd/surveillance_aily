from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.job import JobRead
from app.services.job_creation_service import create_version_recognition_upload_job as create_version_recognition_upload_job_record
from app.services.rbac import ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR

router = APIRouter()


@router.post("/recognize", response_model=JobRead)
def create_version_recognition_upload_job(
    file: Annotated[UploadFile, File(...)],
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR)),
    db: Session = Depends(get_db),
):
    return create_version_recognition_upload_job_record(db, file=file, current_user=current_user)
