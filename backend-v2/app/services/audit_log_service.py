from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal, database_url
from app.core.security import ACCESS_TOKEN_TYPE, decode_token
from app.models.audit_log import OperationAuditLog
from app.models.rbac import User
from app.schemas.audit_log import AuditLogRead
from app.services.ids import generate_id

settings = get_settings()

AUDIT_ALLOWED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
AUDIT_IGNORED_PATH_PREFIXES = {
    f"{settings.api_v1_prefix}/auth/login",
    f"{settings.api_v1_prefix}/auth/refresh",
}


def should_record_audit_log(method: str, path: str) -> bool:
    if method.upper() not in AUDIT_ALLOWED_METHODS:
        return False
    return not any(path.startswith(prefix) for prefix in AUDIT_IGNORED_PATH_PREFIXES)


def write_operation_audit_log(
    *,
    method: str,
    path: str,
    status_code: int,
    duration_ms: int,
    authorization: str | None,
    client_ip: str | None,
    user_agent: str | None,
    error_message: str | None = None,
    details: dict | None = None,
) -> None:
    try:
        with SessionLocal() as db:
            operator_user_id, operator_username = _resolve_operator(db, authorization)
            db.add(
                OperationAuditLog(
                    id=generate_id(),
                    operator_user_id=operator_user_id,
                    operator_username=operator_username,
                    http_method=method.upper(),
                    request_path=path,
                    status_code=status_code,
                    success=200 <= status_code < 400,
                    duration_ms=max(duration_ms, 0),
                    client_ip=client_ip,
                    user_agent=user_agent[:255] if user_agent else None,
                    error_message=error_message,
                    details=details,
                )
            )
            db.commit()
    except Exception:
        # 审计写入失败不应影响主业务链路。
        return


def list_operation_audit_logs(
    db: Session,
    *,
    http_method: str | None = None,
    request_path: str | None = None,
    operator_username: str | None = None,
    success: bool | None = None,
    status_code: int | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 100,
) -> list[AuditLogRead]:
    stmt = select(OperationAuditLog).order_by(OperationAuditLog.created_at.desc(), OperationAuditLog.id.desc())
    if http_method:
        stmt = stmt.where(OperationAuditLog.http_method == http_method.upper())
    if request_path:
        stmt = stmt.where(OperationAuditLog.request_path.contains(request_path))
    if operator_username:
        stmt = stmt.where(OperationAuditLog.operator_username == operator_username)
    if success is not None:
        stmt = stmt.where(OperationAuditLog.success == success)
    if status_code is not None:
        stmt = stmt.where(OperationAuditLog.status_code == status_code)
    if created_from:
        stmt = stmt.where(OperationAuditLog.created_at >= _ensure_aware(created_from))
    if created_to:
        stmt = stmt.where(OperationAuditLog.created_at <= _ensure_aware(created_to))
    stmt = stmt.limit(min(max(limit, 1), 500))
    return [serialize_operation_audit_log(log) for log in db.scalars(stmt)]


def serialize_operation_audit_log(log: OperationAuditLog) -> AuditLogRead:
    created_at = None
    if log.created_at:
        created_at = (
            log.created_at.astimezone(timezone.utc)
            if log.created_at.tzinfo is not None
            else log.created_at.replace(tzinfo=timezone.utc)
        ).isoformat()
    return AuditLogRead(
        id=log.id,
        operator_user_id=log.operator_user_id,
        operator_username=log.operator_username,
        http_method=log.http_method,
        request_path=log.request_path,
        status_code=log.status_code,
        success=log.success,
        duration_ms=log.duration_ms,
        client_ip=log.client_ip,
        user_agent=log.user_agent,
        error_message=log.error_message,
        details=log.details,
        created_at=created_at,
    )


def _resolve_operator(db: Session, authorization: str | None) -> tuple[str | None, str | None]:
    token = _extract_bearer_token(authorization)
    if not token:
        return None, None
    try:
        payload = decode_token(token)
    except Exception:
        return None, None

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        return None, None

    user_id = payload.get("sub")
    if not user_id:
        return None, None

    user = db.get(User, user_id)
    if user is None:
        return user_id, None
    return user_id, user.username


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    return authorization[7:].strip() or None


def _ensure_aware(value: datetime) -> datetime:
    normalized = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if database_url.get_backend_name().startswith("sqlite"):
        return normalized.replace(tzinfo=None)
    return normalized
