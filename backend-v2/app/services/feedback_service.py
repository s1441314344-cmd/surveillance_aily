from datetime import timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.task_record import PredictionFeedback, TaskRecord
from app.schemas.auth import CurrentUser
from app.schemas.feedback import FeedbackCreate, FeedbackRead, FeedbackUpdate
from app.services.ids import generate_id
from app.services.task_record_service import get_task_record_or_404

REVIEWED_JUDGEMENTS = {"correct", "incorrect"}


def serialize_feedback(feedback: PredictionFeedback) -> FeedbackRead:
    return FeedbackRead(
        id=feedback.id,
        record_id=feedback.record_id,
        judgement=feedback.judgement,
        corrected_label=feedback.corrected_label,
        comment=feedback.comment,
        reviewer=feedback.reviewer,
        created_at=feedback.created_at.astimezone(timezone.utc).isoformat() if feedback.created_at else None,
    )


def list_feedback(db: Session, *, record_id: str | None = None) -> list[FeedbackRead]:
    stmt = select(PredictionFeedback).order_by(PredictionFeedback.created_at.desc(), PredictionFeedback.id.desc())
    if record_id:
        stmt = stmt.where(PredictionFeedback.record_id == record_id)
    return [serialize_feedback(item) for item in db.scalars(stmt)]


def get_feedback_or_404(db: Session, feedback_id: str) -> PredictionFeedback:
    feedback = db.get(PredictionFeedback, feedback_id)
    if feedback is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
    return feedback


def get_feedback_by_record(db: Session, record_id: str) -> PredictionFeedback | None:
    stmt = select(PredictionFeedback).where(PredictionFeedback.record_id == record_id)
    return db.scalar(stmt)


def create_feedback(db: Session, payload: FeedbackCreate, current_user: CurrentUser) -> FeedbackRead:
    _validate_judgement(payload.judgement)
    record = get_task_record_or_404(db, payload.record_id)

    existing_feedback = get_feedback_by_record(db, payload.record_id)
    if existing_feedback is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Feedback already exists for this record")

    feedback = PredictionFeedback(
        id=generate_id(),
        record_id=payload.record_id,
        judgement=payload.judgement,
        corrected_label=payload.corrected_label,
        comment=payload.comment,
        reviewer=current_user.display_name or current_user.username,
    )
    db.add(feedback)
    _apply_feedback_status(record, payload.judgement)
    db.commit()
    db.refresh(feedback)
    return serialize_feedback(feedback)


def update_feedback(
    db: Session,
    feedback: PredictionFeedback,
    payload: FeedbackUpdate,
    current_user: CurrentUser,
) -> FeedbackRead:
    updates = payload.model_dump(exclude_unset=True)
    if "judgement" in updates and updates["judgement"] is not None:
        _validate_judgement(updates["judgement"])

    for field_name, value in updates.items():
        setattr(feedback, field_name, value)

    feedback.reviewer = current_user.display_name or current_user.username

    record = get_task_record_or_404(db, feedback.record_id)
    _apply_feedback_status(record, feedback.judgement)
    db.commit()
    db.refresh(feedback)
    return serialize_feedback(feedback)


def _validate_judgement(judgement: str) -> None:
    if judgement not in REVIEWED_JUDGEMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Judgement must be either 'correct' or 'incorrect'",
        )


def _apply_feedback_status(record: TaskRecord, judgement: str) -> None:
    record.feedback_status = judgement
