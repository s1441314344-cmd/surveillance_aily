from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.alert import AlertWebhookCreate, AlertWebhookRead, AlertWebhookUpdate
from app.schemas.auth import CurrentUser
from app.services.alert_service import (
    create_alert_webhook,
    get_alert_webhook_or_404,
    list_alert_webhooks,
    update_alert_webhook,
)
from app.services.rbac import ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[AlertWebhookRead])
def get_alert_webhooks(
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return list_alert_webhooks(db)


@router.post("", response_model=AlertWebhookRead)
def post_alert_webhook(
    payload: AlertWebhookCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return create_alert_webhook(db, payload=payload)


@router.patch("/{webhook_id}", response_model=AlertWebhookRead)
def patch_alert_webhook(
    webhook_id: str,
    payload: AlertWebhookUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    webhook = get_alert_webhook_or_404(db, webhook_id)
    return update_alert_webhook(db, webhook=webhook, payload=payload)
