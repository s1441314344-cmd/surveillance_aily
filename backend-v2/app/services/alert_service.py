from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import AlertEvent, AlertWebhookDelivery, AlertWebhookEndpoint
from app.schemas.alert import (
    AlertEventRead,
    AlertWebhookCreate,
    AlertWebhookDeliveryRead,
    AlertWebhookRead,
    AlertWebhookUpdate,
)
from app.services.ids import generate_id

ALERT_STATUS_OPEN = "open"
ALERT_STATUS_ACKED = "acked"
ALERT_STATUS_RESOLVED = "resolved"
ALERT_WEBHOOK_STATUS_ACTIVE = "active"
ALERT_WEBHOOK_STATUS_INACTIVE = "inactive"
VALID_ALERT_WEBHOOK_STATUSES = {ALERT_WEBHOOK_STATUS_ACTIVE, ALERT_WEBHOOK_STATUS_INACTIVE}
ALERT_STATUS_FILTER_ALIASES = {
    "acknowledged": ALERT_STATUS_ACKED,
}
ALERT_SEVERITY_LEVELS = {"critical", "high", "medium", "low"}


def serialize_alert_event(item: AlertEvent) -> AlertEventRead:
    return AlertEventRead(
        id=item.id,
        camera_id=item.camera_id,
        rule_id=item.rule_id,
        rule_name=item.rule_name,
        event_key=item.event_key,
        confidence=float(item.confidence or 0),
        status=item.status,
        message=item.message,
        media_id=item.media_id,
        payload=item.payload,
        occurred_at=_serialize_datetime(item.occurred_at) or "",
        acked_at=_serialize_datetime(item.acked_at),
        resolved_at=_serialize_datetime(item.resolved_at),
        created_at=_serialize_datetime(item.created_at),
        updated_at=_serialize_datetime(item.updated_at),
    )


def serialize_alert_webhook(item: AlertWebhookEndpoint) -> AlertWebhookRead:
    return AlertWebhookRead(
        id=item.id,
        name=item.name,
        url=item.url,
        status=item.status,
        timeout_seconds=item.timeout_seconds,
        has_secret=bool(item.secret),
        created_at=_serialize_datetime(item.created_at),
        updated_at=_serialize_datetime(item.updated_at),
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
        next_retry_at=_serialize_datetime(item.next_retry_at),
        last_attempt_at=_serialize_datetime(item.last_attempt_at),
        created_at=_serialize_datetime(item.created_at),
        updated_at=_serialize_datetime(item.updated_at),
    )


def list_alert_events(
    db: Session,
    *,
    camera_id: str | None = None,
    status_filter: str | None = None,
    severity_filter: str | None = None,
    keyword: str | None = None,
    limit: int = 50,
) -> list[AlertEventRead]:
    safe_limit = min(max(limit, 1), 200)
    normalized_status = _normalize_alert_status_filter(status_filter)
    normalized_severity = _normalize_alert_severity_filter(severity_filter)
    normalized_keyword = _normalize_keyword_filter(keyword)

    stmt = select(AlertEvent).order_by(AlertEvent.occurred_at.desc(), AlertEvent.id.desc())
    if camera_id:
        stmt = stmt.where(AlertEvent.camera_id == camera_id)
    if normalized_status:
        stmt = stmt.where(AlertEvent.status == normalized_status)
    events = list(db.scalars(stmt))

    if normalized_severity:
        events = [item for item in events if _infer_alert_severity(item) == normalized_severity]

    if normalized_keyword:
        events = [item for item in events if _alert_event_contains_keyword(item, normalized_keyword)]

    return [serialize_alert_event(item) for item in events[:safe_limit]]


def get_alert_event_or_404(db: Session, alert_id: str) -> AlertEvent:
    item = db.get(AlertEvent, alert_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return item


def ack_alert_event(
    db: Session,
    *,
    alert: AlertEvent,
) -> AlertEventRead:
    if alert.status == ALERT_STATUS_RESOLVED:
        return serialize_alert_event(alert)
    alert.status = ALERT_STATUS_ACKED
    if alert.acked_at is None:
        alert.acked_at = _utcnow()
    db.commit()
    db.refresh(alert)
    return serialize_alert_event(alert)


def resolve_alert_event(
    db: Session,
    *,
    alert: AlertEvent,
) -> AlertEventRead:
    now = _utcnow()
    if alert.acked_at is None:
        alert.acked_at = now
    alert.status = ALERT_STATUS_RESOLVED
    alert.resolved_at = now
    db.commit()
    db.refresh(alert)
    return serialize_alert_event(alert)


def create_alert_event(
    db: Session,
    *,
    camera_id: str,
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
    event = AlertEvent(
        id=generate_id(),
        camera_id=camera_id,
        rule_id=rule_id,
        rule_name=rule_name,
        event_key=event_key,
        confidence=float(confidence),
        status=ALERT_STATUS_OPEN,
        message=message,
        media_id=media_id,
        payload=payload,
        occurred_at=_ensure_aware(occurred_at or _utcnow()),
        acked_at=None,
        resolved_at=None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    if dispatch_webhooks:
        dispatch_alert_webhooks(db, event=event)
    return event


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
    status_value = _resolve_webhook_status(
        status=payload.status,
        enabled=payload.enabled,
        default=ALERT_WEBHOOK_STATUS_ACTIVE,
    )
    _validate_webhook_status(status_value)
    url_value = _resolve_webhook_url(url=payload.url, endpoint=payload.endpoint, required=True)
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
    status_value = _resolve_webhook_status(
        status=updates.get("status"),
        enabled=updates.get("enabled"),
    )
    if status_value is not None:
        _validate_webhook_status(status_value)
        updates["status"] = status_value

    url_value = _resolve_webhook_url(
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
    now = _utcnow()
    for endpoint in endpoints:
        response_code = None
        response_body = None
        last_error = None
        delivery_status = "success"
        try:
            headers = {"Content-Type": "application/json"}
            if endpoint.secret:
                headers["X-Surveillance-Webhook-Secret"] = endpoint.secret
            with httpx.Client(timeout=endpoint.timeout_seconds) as client:
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
) -> list[str]:
    current_time = _ensure_aware(now or _utcnow())
    stmt = (
        select(AlertWebhookDelivery)
        .where(AlertWebhookDelivery.status == "failed")
        .where(AlertWebhookDelivery.attempt_count < 3)
        .where(
            (AlertWebhookDelivery.next_retry_at.is_(None))
            | (AlertWebhookDelivery.next_retry_at <= current_time)
        )
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
            with httpx.Client(timeout=endpoint.timeout_seconds) as client:
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


def _validate_webhook_status(value: str) -> None:
    if value not in VALID_ALERT_WEBHOOK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported webhook status: {value}",
        )


def _resolve_webhook_status(
    *,
    status: str | None,
    enabled: bool | None,
    default: str | None = None,
) -> str | None:
    if status is not None:
        value = str(status).strip().lower()
        return value or default
    if enabled is not None:
        return ALERT_WEBHOOK_STATUS_ACTIVE if enabled else ALERT_WEBHOOK_STATUS_INACTIVE
    return default


def _resolve_webhook_url(
    *,
    url: str | None,
    endpoint: str | None,
    required: bool,
) -> str | None:
    candidate = url if url is not None else endpoint
    if candidate is None:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Webhook url is required",
            )
        return None
    value = str(candidate).strip()
    if value:
        return value
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Webhook url is required",
    )


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
        "occurred_at": _serialize_datetime(event.occurred_at),
        "acked_at": _serialize_datetime(event.acked_at),
        "resolved_at": _serialize_datetime(event.resolved_at),
    }


def _normalize_alert_status_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    return ALERT_STATUS_FILTER_ALIASES.get(normalized, normalized)


def _normalize_alert_severity_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    return normalized if normalized in ALERT_SEVERITY_LEVELS else None


def _normalize_keyword_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _infer_alert_severity(item: AlertEvent) -> str:
    payload = item.payload if isinstance(item.payload, dict) else {}
    payload_severity = payload.get("severity")
    if isinstance(payload_severity, str):
        normalized = payload_severity.strip().lower()
        if normalized in ALERT_SEVERITY_LEVELS:
            return normalized

    confidence = float(item.confidence or 0)
    if confidence >= 0.9:
        return "critical"
    if confidence >= 0.7:
        return "high"
    if confidence >= 0.4:
        return "medium"
    return "low"


def _alert_event_contains_keyword(item: AlertEvent, keyword: str) -> bool:
    payload_text = ""
    if isinstance(item.payload, dict):
        try:
            payload_text = json.dumps(item.payload, ensure_ascii=False)
        except Exception:
            payload_text = str(item.payload)

    haystack = " ".join(
        part
        for part in [item.rule_name, item.event_key, item.message, payload_text]
        if part
    ).lower()
    return keyword in haystack


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _ensure_aware(value).isoformat()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
