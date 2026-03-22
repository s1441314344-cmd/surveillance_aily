from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.user import UserCreate, UserRead, UserStatusUpdate
from app.services.rbac import ROLE_SYSTEM_ADMIN
from app.services.user_service import create_user as create_user_record
from app.services.user_service import list_users as list_user_records
from app.services.user_service import update_user_status as update_user_status_record

router = APIRouter()


@router.get("", response_model=list[UserRead])
def list_users(
    _: UserRead | None = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return list_user_records(db)


@router.post("", response_model=UserRead)
def create_user(
    payload: UserCreate,
    _: UserRead | None = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return create_user_record(db, payload)


@router.patch("/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    _: UserRead | None = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return update_user_status_record(db, user_id, payload.is_active)
