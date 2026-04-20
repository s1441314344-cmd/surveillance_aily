from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import AlertEvent, AlertWebhookDelivery, AlertWebhookEndpoint
from app.schemas.alert import (
    AlertWebhookCreate,
    AlertWebhookDeliveryRead,
    AlertWebhookRead,
    AlertWebhookUpdate,
)
from app.services.alert_common import (
    ALERT_WEBHOOK_STATUS_ACTIVE,
    ensure_aware,
    resolve_webhook_status,
    resolve_webhook_url,
    serialize_datetime,
    utcnow,
    validate_webhook_status,
)
from app.services.ids import generate_id

HttpxClientFactory = Callable[..., object]


def serialize_alert_webhook(item: AlertWebhookEndpoint) -> AlertWebhookRead:
    return AlertWebhookRead(
        id=item.id,
        name=item.name,
        url=item.url,
        status=item.status,
        timeout_seconds=item.timeout_seconds,
        has_secret=bool(item.secret),
        created_at=serialize_datetime(item.created_at),
        updated_at=serialize_datetime(item.updated_at),
    )


def serialize_alert_webhook_delivery(item: AlertWebhookDelivery) -> AlertWebhookDeliveryRead:
    return AlertWebhookDeliveryRead(
        id=item.id,
        event_id=item.event_id,
        endpoint_id=item.endpoint_id,
        status=item.status,
        attempt_count=item.attempt_count,
        response_code=item.response_code,
        response_body=item.response_body,
        last_error=item.last_error,
        next_retry_at=serialize_datetime(item.next_retry_at),
        last_attempt_at=serialize_datetime(item.last_attempt_at),
        created_at=serialize_datetime(item.created_at),
        updated_at=serialize_datetime(item.updated_at),
    )


def list_alert_webhooks(
    db: Session,
    *,
    status_filter: str | None = None,
) -> list[AlertWebhookRead]:
    stmt = select(AlertWebhookEndpoint).order_by(AlertWebhookEndpoint.created_at.desc(), AlertWebhookEndpoint.id.desc())
    if status_filter:
        stmt = stmt.where(AlertWebhookEndpoint.status == status_filter)
    return [serialize_alert_webhook(item) for item in db.scalars(stmt)]


def get_alert_webhook_or_404(db: Session, webhook_id: str) -> AlertWebhookEndpoint:
    item = db.get(AlertWebhookEndpoint, webhook_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert webhook not found")
    return item


def create_alert_webhook(
    db: Session,
    *,
    payload: AlertWebhookCreate,
) -> AlertWebhookRead:
    status_value = resolve_webhook_status(
        status=payload.status,
        enabled=payload.enabled,
        default=ALERT_WEBHOOK_STATUS_ACTIVE,
    )
    if status_value is None:
        status_value = ALERT_WEBHOOK_STATUS_ACTIVE
    validate_webhook_status(status_value)
    url_value = resolve_webhook_url(url=payload.url, endpoint=payload.endpoint, required=True)
    item = AlertWebhookEndpoint(
        id=generate_id(),
        name=payload.name.strip(),
        url=url_value,
        secret=(payload.secret or "").strip() or None,
        status=status_value,
        timeout_seconds=int(payload.timeout_seconds),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_alert_webhook(item)


def update_alert_webhook(
    db: Session,
    *,
    webhook: AlertWebhookEndpoint,
    payload: AlertWebhookUpdate,
) -> AlertWebhookRead:
    updates = payload.model_dump(exclude_unset=True)
    status_value = resolve_webhook_status(
        status=updates.get("status"),
        enabled=updates.get("enabled"),
    )
    if status_value is not None:
        validate_webhook_status(status_value)
        updates["status"] = status_value

    url_value = resolve_webhook_url(
        url=updates.get("url"),
        endpoint=updates.get("endpoint"),
        required=False,
    )
    if url_value is not None:
        updates["url"] = url_value

    updates.pop("enabled", None)
    updates.pop("endpoint", None)
    updates.pop("events", None)

    for field_name, value in updates.items():
        if field_name in {"name", "url"} and value is not None:
            value = str(value).strip()
        if field_name == "secret" and value is not None:
            value = str(value).strip() or None
        setattr(webhook, field_name, value)
    db.commit()
    db.refresh(webhook)
    return serialize_alert_webhook(webhook)


def list_alert_webhook_deliveries(
    db: Session,
    *,
    event_id: str | None = None,
    endpoint_id: str | None = None,
    limit: int = 50,
) -> list[AlertWebhookDeliveryRead]:
    safe_limit = min(max(limit, 1), 200)
    stmt = (
        select(AlertWebhookDelivery)
        .order_by(AlertWebhookDelivery.last_attempt_at.desc(), AlertWebhookDelivery.id.desc())
        .limit(safe_limit)
    )
    if event_id:
        stmt = stmt.where(AlertWebhookDelivery.event_id == event_id)
    if endpoint_id:
        stmt = stmt.where(AlertWebhookDelivery.endpoint_id == endpoint_id)
    return [serialize_alert_webhook_delivery(item) for item in db.scalars(stmt)]


def dispatch_alert_webhooks(
    db: Session,
    *,
    event: AlertEvent,
    httpx_client_factory: HttpxClientFactory,
) -> list[AlertWebhookDelivery]:
    stmt = (
        select(AlertWebhookEndpoint)
        .where(AlertWebhookEndpoint.status == ALERT_WEBHOOK_STATUS_ACTIVE)
        .order_by(AlertWebhookEndpoint.created_at.asc(), AlertWebhookEndpoint.id.asc())
    )
    endpoints = list(db.scalars(stmt))
    if not endpoints:
        return []

    deliveries: list[AlertWebhookDelivery] = []
    payload = _build_alert_webhook_payload(event)
    now = utcnow()
    for endpoint in endpoints:
        response_code = None
        response_body = None
        last_error = None
        delivery_status = "success"
        try:
            headers = {"Content-Type": "application/json"}
            if endpoint.secret:
                headers["X-Surveillance-Webhook-Secret"] = endpoint.secret
            with httpx_client_factory(timeout=endpoint.timeout_seconds) as client:
                response = client.post(endpoint.url, json=payload, headers=headers)
                response_code = int(response.status_code)
                response_body = (response.text or "")[:1000]
                if response.status_code >= 400:
                    delivery_status = "failed"
                    last_error = f"HTTP {response.status_code}"
        except Exception as exc:  # pragma: no cover - depends on remote endpoint state
            delivery_status = "failed"
            last_error = str(exc)

        delivery = AlertWebhookDelivery(
            id=generate_id(),
            event_id=event.id,
            endpoint_id=endpoint.id,
            status=delivery_status,
            attempt_count=1,
            response_code=response_code,
            response_body=response_body,
            last_error=last_error,
            next_retry_at=None,
            last_attempt_at=now,
        )
        db.add(delivery)
        deliveries.append(delivery)

    db.commit()
    for delivery in deliveries:
        db.refresh(delivery)
    return deliveries


def run_due_alert_webhook_deliveries_once(
    db: Session,
    *,
    now: datetime | None = None,
    httpx_client_factory: HttpxClientFactory,
) -> list[str]:
    current_time = ensure_aware(now or utcnow())
    stmt = (
        select(AlertWebhookDelivery)
        .where(AlertWebhookDelivery.status == "failed")
        .where(AlertWebhookDelivery.attempt_count < 3)
        .where((AlertWebhookDelivery.next_retry_at.is_(None)) | (AlertWebhookDelivery.next_retry_at <= current_time))
        .order_by(AlertWebhookDelivery.last_attempt_at.asc(), AlertWebhookDelivery.id.asc())
    )
    deliveries = list(db.scalars(stmt))
    retried_ids: list[str] = []
    for delivery in deliveries:
        endpoint = db.get(AlertWebhookEndpoint, delivery.endpoint_id)
        event = db.get(AlertEvent, delivery.event_id)
        if endpoint is None or event is None or endpoint.status != ALERT_WEBHOOK_STATUS_ACTIVE:
            continue
        payload = _build_alert_webhook_payload(event)
        response_code = None
        response_body = None
        last_error = None
        status_value = "success"
        try:
            headers = {"Content-Type": "application/json"}
            if endpoint.secret:
                headers["X-Surveillance-Webhook-Secret"] = endpoint.secret
            with httpx_client_factory(timeout=endpoint.timeout_seconds) as client:
                response = client.post(endpoint.url, json=payload, headers=headers)
                response_code = int(response.status_code)
                response_body = (response.text or "")[:1000]
                if response.status_code >= 400:
                    status_value = "failed"
                    last_error = f"HTTP {response.status_code}"
        except Exception as exc:  # pragma: no cover - depends on remote endpoint state
            status_value = "failed"
            last_error = str(exc)

        delivery.status = status_value
        delivery.attempt_count = int(delivery.attempt_count or 0) + 1
        delivery.response_code = response_code
        delivery.response_body = response_body
        delivery.last_error = last_error
        delivery.last_attempt_at = current_time
        delivery.next_retry_at = (
            None if status_value == "success" else current_time.replace(microsecond=0) + timedelta(minutes=1)
        )
        retried_ids.append(delivery.id)

    if retried_ids:
        db.commit()
    return retried_ids


def _build_alert_webhook_payload(event: AlertEvent) -> dict:
    return {
        "id": event.id,
        "camera_id": event.camera_id,
        "rule_id": event.rule_id,
        "rule_name": event.rule_name,
        "event_key": event.event_key,
        "confidence": float(event.confidence or 0),
        "status": event.status,
        "message": event.message,
        "media_id": event.media_id,
        "payload": event.payload,
        "occurred_at": serialize_datetime(event.occurred_at),
        "acked_at": serialize_datetime(event.acked_at),
        "resolved_at": serialize_datetime(event.resolved_at),
    }
