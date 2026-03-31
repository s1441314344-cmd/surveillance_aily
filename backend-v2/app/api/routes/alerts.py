from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.alert import AlertEventRead, AlertWebhookCreate, AlertWebhookRead, AlertWebhookUpdate
from app.schemas.auth import CurrentUser
from app.services.alert_service import (
    ack_alert_event,
    create_alert_webhook,
    get_alert_event_or_404,
    get_alert_webhook_or_404,
    list_alert_events,
    list_alert_webhooks,
    resolve_alert_event,
    update_alert_webhook,
)
from app.services.rbac import ROLE_ANALYSIS_VIEWER, ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR

router = APIRouter()


@router.get("", response_model=list[AlertEventRead])
def get_alerts(
    camera_id: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    keyword: str | None = None,
    limit: int = 50,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_alert_events(
        db,
        camera_id=camera_id,
        status_filter=status,
        severity_filter=severity,
        keyword=keyword,
        limit=limit,
    )


@router.patch("/{alert_id}/ack", response_model=AlertEventRead)
@router.post("/{alert_id}/ack", response_model=AlertEventRead)
def ack_alert(
    alert_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR, ROLE_ANALYSIS_VIEWER)),
    db: Session = Depends(get_db),
):
    alert = get_alert_event_or_404(db, alert_id)
    return ack_alert_event(db, alert=alert)


@router.patch("/{alert_id}/resolve", response_model=AlertEventRead)
@router.post("/{alert_id}/resolve", response_model=AlertEventRead)
def resolve_alert(
    alert_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR, ROLE_ANALYSIS_VIEWER)),
    db: Session = Depends(get_db),
):
    alert = get_alert_event_or_404(db, alert_id)
    return resolve_alert_event(db, alert=alert)


@router.get("/webhooks", response_model=list[AlertWebhookRead])
def get_alert_webhooks(
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return list_alert_webhooks(db)


@router.post("/webhooks", response_model=AlertWebhookRead)
def post_alert_webhook(
    payload: AlertWebhookCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return create_alert_webhook(db, payload=payload)


@router.patch("/webhooks/{webhook_id}", response_model=AlertWebhookRead)
def patch_alert_webhook(
    webhook_id: str,
    payload: AlertWebhookUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    webhook = get_alert_webhook_or_404(db, webhook_id)
    return update_alert_webhook(db, webhook=webhook, payload=payload)
