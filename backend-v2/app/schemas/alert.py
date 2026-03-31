from pydantic import BaseModel, Field


class AlertEventRead(BaseModel):
    id: str
    camera_id: str
    rule_id: str | None = None
    rule_name: str | None = None
    event_key: str
    confidence: float
    status: str
    message: str | None = None
    media_id: str | None = None
    payload: dict | None = None
    occurred_at: str
    acked_at: str | None = None
    resolved_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AlertEventStatusUpdate(BaseModel):
    status: str = Field(pattern="^(acked|resolved)$")


class AlertWebhookRead(BaseModel):
    id: str
    name: str
    url: str
    status: str
    timeout_seconds: int
    has_secret: bool = False
    created_at: str | None = None
    updated_at: str | None = None


class AlertWebhookCreate(BaseModel):
    name: str
    url: str | None = None
    endpoint: str | None = None
    status: str | None = None
    enabled: bool | None = None
    events: list[str] | None = None
    timeout_seconds: int = Field(default=5, ge=1, le=30)
    secret: str | None = None


class AlertWebhookUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    endpoint: str | None = None
    status: str | None = None
    enabled: bool | None = None
    events: list[str] | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=30)
    secret: str | None = None


class AlertWebhookDeliveryRead(BaseModel):
    id: str
    event_id: str
    endpoint_id: str
    status: str
    attempt_count: int
    response_code: int | None = None
    response_body: str | None = None
    last_error: str | None = None
    next_retry_at: str | None = None
    last_attempt_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
