from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.audit_log import AuditLogRead
from app.schemas.auth import CurrentUser
from app.services.audit_log_service import list_operation_audit_logs
from app.services.rbac import ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    http_method: str | None = None,
    request_path: str | None = None,
    operator_username: str | None = None,
    success: bool | None = None,
    status_code: int | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 100,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return list_operation_audit_logs(
        db,
        http_method=http_method,
        request_path=request_path,
        operator_username=operator_username,
        success=success,
        status_code=status_code,
        created_from=created_from,
        created_to=created_to,
        limit=limit,
    )
