from pydantic import BaseModel, ConfigDict


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    record_id: str
    judgement: str
    corrected_label: str | None = None
    comment: str | None = None


class FeedbackUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    judgement: str | None = None
    corrected_label: str | None = None
    comment: str | None = None


class FeedbackRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    record_id: str
    judgement: str
    corrected_label: str | None = None
    comment: str | None = None
    reviewer: str
    created_at: str | None = None
