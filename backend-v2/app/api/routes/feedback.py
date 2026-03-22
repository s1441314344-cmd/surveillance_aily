from fastapi import APIRouter

from app.schemas.feedback import FeedbackCreate, FeedbackRead, FeedbackUpdate

router = APIRouter()


@router.post("", response_model=FeedbackRead)
def create_feedback(payload: FeedbackCreate):
    return FeedbackRead(
        id="feedback-placeholder",
        record_id=payload.record_id,
        judgement=payload.judgement,
        corrected_label=payload.corrected_label,
        comment=payload.comment,
        reviewer=payload.reviewer,
    )


@router.patch("/{feedback_id}", response_model=FeedbackRead)
def update_feedback(feedback_id: str, payload: FeedbackUpdate):
    return FeedbackRead(
        id=feedback_id,
        record_id=payload.record_id or "record-placeholder",
        judgement=payload.judgement or "correct",
        corrected_label=payload.corrected_label,
        comment=payload.comment,
        reviewer=payload.reviewer or "reviewer",
    )
