from __future__ import annotations

import subprocess
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.alert import (
    AlertEvent,
    AlertNotificationRoute,
    AlertWebhookDelivery,
    AlertWebhookEndpoint,
)
from app.schemas.alert import (
    AlertEventRead,
    AlertFeishuChatSearchResponse,
    AlertFeishuUserSearchResponse,
    AlertNotificationRouteCreate,
    AlertNotificationRouteRead,
    AlertNotificationRouteUpdate,
    AlertWebhookCreate,
    AlertWebhookDeliveryRead,
    AlertWebhookRead,
    AlertWebhookUpdate,
)
from app.services.alert_common import (
    ALERT_NOTIFICATION_RECIPIENT_TYPES,
    ALERT_SEVERITY_LEVELS,
    ALERT_STATUS_ACKED,
    ALERT_STATUS_OPEN,
    ALERT_STATUS_RESOLVED,
    ALERT_STATUS_FILTER_ALIASES,
    ALERT_WEBHOOK_STATUS_ACTIVE,
    ALERT_WEBHOOK_STATUS_INACTIVE,
    VALID_ALERT_WEBHOOK_STATUSES,
)
from app.services import alert_event_queries, alert_notification_helpers, alert_webhook_helpers

settings = get_settings()

serialize_alert_event = alert_event_queries.serialize_alert_event
list_alert_events = alert_event_queries.list_alert_events
get_alert_event_or_404 = alert_event_queries.get_alert_event_or_404
ack_alert_event = alert_event_queries.ack_alert_event
resolve_alert_event = alert_event_queries.resolve_alert_event

serialize_alert_webhook = alert_webhook_helpers.serialize_alert_webhook
serialize_alert_webhook_delivery = alert_webhook_helpers.serialize_alert_webhook_delivery
list_alert_webhooks = alert_webhook_helpers.list_alert_webhooks
get_alert_webhook_or_404 = alert_webhook_helpers.get_alert_webhook_or_404
create_alert_webhook = alert_webhook_helpers.create_alert_webhook
update_alert_webhook = alert_webhook_helpers.update_alert_webhook
list_alert_webhook_deliveries = alert_webhook_helpers.list_alert_webhook_deliveries

serialize_alert_notification_route = alert_notification_helpers.serialize_alert_notification_route
list_alert_notification_routes = alert_notification_helpers.list_alert_notification_routes
get_alert_notification_route_or_404 = alert_notification_helpers.get_alert_notification_route_or_404
create_alert_notification_route = alert_notification_helpers.create_alert_notification_route
update_alert_notification_route = alert_notification_helpers.update_alert_notification_route


def create_alert_event(
    db: Session,
    *,
    camera_id: str,
    strategy_id: str | None,
    strategy_name: str | None,
    rule_id: str | None,
    rule_name: str | None,
    event_key: str,
    confidence: float,
    message: str | None,
    media_id: str | None,
    payload: dict | None,
    occurred_at: datetime | None = None,
    dispatch_webhooks: bool = True,
) -> AlertEvent:
    return alert_event_queries.create_alert_event(
        db,
        camera_id=camera_id,
        strategy_id=strategy_id,
        strategy_name=strategy_name,
        rule_id=rule_id,
        rule_name=rule_name,
        event_key=event_key,
        confidence=confidence,
        message=message,
        media_id=media_id,
        payload=payload,
        occurred_at=occurred_at,
        dispatch_webhooks=dispatch_webhooks,
        dispatch_webhooks_fn=lambda active_db, event: dispatch_alert_webhooks(active_db, event=event),
        dispatch_notifications_fn=lambda active_db, event: dispatch_alert_notifications(active_db, event=event),
    )


def search_lark_users_for_alert_routes(
    *,
    keyword: str,
    limit: int = 20,
    page_token: str | None = None,
) -> AlertFeishuUserSearchResponse:
    return alert_notification_helpers.search_lark_users_for_alert_routes(
        keyword=keyword,
        limit=limit,
        page_token=page_token,
        settings_obj=settings,
        subprocess_run=subprocess.run,
    )


def search_lark_chats_for_alert_routes(
    *,
    keyword: str | None = None,
    limit: int = 20,
    page_token: str | None = None,
) -> AlertFeishuChatSearchResponse:
    return alert_notification_helpers.search_lark_chats_for_alert_routes(
        keyword=keyword,
        limit=limit,
        page_token=page_token,
        settings_obj=settings,
        subprocess_run=subprocess.run,
    )


def dispatch_alert_webhooks(
    db: Session,
    *,
    event: AlertEvent,
) -> list[AlertWebhookDelivery]:
    return alert_webhook_helpers.dispatch_alert_webhooks(
        db,
        event=event,
        httpx_client_factory=httpx.Client,
    )


def dispatch_alert_notifications(
    db: Session,
    *,
    event: AlertEvent,
) -> list[str]:
    return alert_notification_helpers.dispatch_alert_notifications(
        db,
        event=event,
        settings_obj=settings,
        subprocess_run=subprocess.run,
    )


def run_due_alert_webhook_deliveries_once(
    db: Session,
    *,
    now: datetime | None = None,
) -> list[str]:
    return alert_webhook_helpers.run_due_alert_webhook_deliveries_once(
        db,
        now=now,
        httpx_client_factory=httpx.Client,
    )


__all__ = [
    "ALERT_NOTIFICATION_RECIPIENT_TYPES",
    "ALERT_SEVERITY_LEVELS",
    "ALERT_STATUS_ACKED",
    "ALERT_STATUS_OPEN",
    "ALERT_STATUS_RESOLVED",
    "ALERT_STATUS_FILTER_ALIASES",
    "ALERT_WEBHOOK_STATUS_ACTIVE",
    "ALERT_WEBHOOK_STATUS_INACTIVE",
    "VALID_ALERT_WEBHOOK_STATUSES",
    "ack_alert_event",
    "create_alert_event",
    "create_alert_notification_route",
    "create_alert_webhook",
    "dispatch_alert_notifications",
    "dispatch_alert_webhooks",
    "get_alert_event_or_404",
    "get_alert_notification_route_or_404",
    "get_alert_webhook_or_404",
    "list_alert_events",
    "list_alert_notification_routes",
    "list_alert_webhook_deliveries",
    "list_alert_webhooks",
    "resolve_alert_event",
    "run_due_alert_webhook_deliveries_once",
    "search_lark_chats_for_alert_routes",
    "search_lark_users_for_alert_routes",
    "serialize_alert_event",
    "serialize_alert_notification_route",
    "serialize_alert_webhook",
    "serialize_alert_webhook_delivery",
    "update_alert_notification_route",
    "update_alert_webhook",
]
