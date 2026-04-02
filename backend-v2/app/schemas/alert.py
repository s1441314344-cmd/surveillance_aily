from pydantic import BaseModel, Field


class AlertEventRead(BaseModel):
    id: str
    camera_id: str
    strategy_id: str | None = None
    strategy_name: str | None = None
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


class AlertNotificationRouteRead(BaseModel):
    id: str
    name: str
    strategy_id: str | None = None
    strategy_name: str | None = None
    event_key: str | None = None
    severity: str | None = None
    camera_id: str | None = None
    recipient_type: str
    recipient_id: str
    enabled: bool
    priority: int
    cooldown_seconds: int
    message_template: str | None = None
    last_error: str | None = None
    last_delivered_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class AlertNotificationRouteCreate(BaseModel):
    name: str
    strategy_id: str | None = None
    event_key: str | None = None
    severity: str | None = Field(default=None, pattern="^(critical|high|medium|low)$")
    camera_id: str | None = None
    recipient_type: str = Field(pattern="^(user|chat)$")
    recipient_id: str
    enabled: bool = True
    priority: int = Field(default=100, ge=0, le=100000)
    cooldown_seconds: int = Field(default=0, ge=0, le=86400)
    message_template: str | None = None


class AlertNotificationRouteUpdate(BaseModel):
    name: str | None = None
    strategy_id: str | None = None
    event_key: str | None = None
    severity: str | None = Field(default=None, pattern="^(critical|high|medium|low)$")
    camera_id: str | None = None
    recipient_type: str | None = Field(default=None, pattern="^(user|chat)$")
    recipient_id: str | None = None
    enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=100000)
    cooldown_seconds: int | None = Field(default=None, ge=0, le=86400)
    message_template: str | None = None


class AlertFeishuUserCandidate(BaseModel):
    id: str
    open_id: str
    user_id: str | None = None
    employee_id: str | None = None
    name: str
    avatar_url: str | None = None
    department_ids: list[str] = Field(default_factory=list)


class AlertFeishuUserSearchResponse(BaseModel):
    items: list[AlertFeishuUserCandidate]
    has_more: bool = False
    page_token: str | None = None


class AlertFeishuChatCandidate(BaseModel):
    id: str
    chat_id: str
    name: str
    avatar_url: str | None = None
    description: str | None = None
    owner_open_id: str | None = None
    external: bool = False


class AlertFeishuChatSearchResponse(BaseModel):
    items: list[AlertFeishuChatCandidate]
    has_more: bool = False
    page_token: str | None = None
