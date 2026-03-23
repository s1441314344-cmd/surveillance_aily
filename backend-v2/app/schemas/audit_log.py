from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: str
    operator_user_id: str | None = None
    operator_username: str | None = None
    http_method: str
    request_path: str
    status_code: int
    success: bool
    duration_ms: int
    client_ip: str | None = None
    user_agent: str | None = None
    error_message: str | None = None
    details: dict | None = None
    created_at: str | None = None
