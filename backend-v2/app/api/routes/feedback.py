from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.feedback import FeedbackCreate, FeedbackRead, FeedbackUpdate
from app.services.feedback_service import (
    create_feedback as create_feedback_record,
    get_feedback_or_404,
    list_feedback as list_feedback_records,
    serialize_feedback,
    update_feedback as update_feedback_record,
)
from app.services.rbac import ROLE_MANUAL_REVIEWER, ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[FeedbackRead])
def list_feedback(
    record_id: str | None = None,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER)),
    db: Session = Depends(get_db),
):
    return list_feedback_records(db, record_id=record_id)


@router.post("", response_model=FeedbackRead)
def create_feedback(
    payload: FeedbackCreate,
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER)),
    db: Session = Depends(get_db),
):
    return create_feedback_record(db, payload, current_user)


@router.get("/{feedback_id}", response_model=FeedbackRead)
def get_feedback(
    feedback_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER)),
    db: Session = Depends(get_db),
):
    return serialize_feedback(get_feedback_or_404(db, feedback_id))


@router.patch("/{feedback_id}", response_model=FeedbackRead)
def update_feedback(
    feedback_id: str,
    payload: FeedbackUpdate,
    current_user: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER)),
    db: Session = Depends(get_db),
):
    return update_feedback_record(db, get_feedback_or_404(db, feedback_id), payload, current_user)
