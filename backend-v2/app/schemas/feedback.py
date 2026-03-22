from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    record_id: str
    judgement: str
    corrected_label: str | None = None
    comment: str | None = None
    reviewer: str


class FeedbackUpdate(BaseModel):
    record_id: str | None = None
    judgement: str | None = None
    corrected_label: str | None = None
    comment: str | None = None
    reviewer: str | None = None


class FeedbackRead(BaseModel):
    id: str
    record_id: str
    judgement: str
    corrected_label: str | None = None
    comment: str | None = None
    reviewer: str
