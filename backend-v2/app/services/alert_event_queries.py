from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import AlertEvent
from app.schemas.alert import AlertEventRead
from app.services.alert_common import (
    ALERT_STATUS_ACKED,
    ALERT_STATUS_OPEN,
    ALERT_STATUS_RESOLVED,
    alert_event_contains_keyword,
    ensure_aware,
    infer_alert_severity,
    normalize_alert_severity_filter,
    normalize_alert_status_filter,
    normalize_keyword_filter,
    serialize_datetime,
    utcnow,
)
from app.services.ids import generate_id

DispatchEventFn = Callable[[Session, AlertEvent], object]


def serialize_alert_event(item: AlertEvent) -> AlertEventRead:
    return AlertEventRead(
        id=item.id,
        camera_id=item.camera_id,
        strategy_id=item.strategy_id,
        strategy_name=item.strategy_name,
        rule_id=item.rule_id,
        rule_name=item.rule_name,
        event_key=item.event_key,
        confidence=float(item.confidence or 0),
        status=item.status,
        message=item.message,
        media_id=item.media_id,
        payload=item.payload,
        occurred_at=serialize_datetime(item.occurred_at) or "",
        acked_at=serialize_datetime(item.acked_at),
        resolved_at=serialize_datetime(item.resolved_at),
        created_at=serialize_datetime(item.created_at),
        updated_at=serialize_datetime(item.updated_at),
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
    normalized_status = normalize_alert_status_filter(status_filter)
    normalized_severity = normalize_alert_severity_filter(severity_filter)
    normalized_keyword = normalize_keyword_filter(keyword)

    stmt = select(AlertEvent).order_by(AlertEvent.occurred_at.desc(), AlertEvent.id.desc())
    if camera_id:
        stmt = stmt.where(AlertEvent.camera_id == camera_id)
    if normalized_status:
        stmt = stmt.where(AlertEvent.status == normalized_status)
    events = list(db.scalars(stmt))

    if normalized_severity:
        events = [item for item in events if infer_alert_severity(item) == normalized_severity]

    if normalized_keyword:
        events = [item for item in events if alert_event_contains_keyword(item, normalized_keyword)]

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
        alert.acked_at = utcnow()
    db.commit()
    db.refresh(alert)
    return serialize_alert_event(alert)


def resolve_alert_event(
    db: Session,
    *,
    alert: AlertEvent,
) -> AlertEventRead:
    now = utcnow()
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
    dispatch_webhooks_fn: DispatchEventFn | None = None,
    dispatch_notifications_fn: DispatchEventFn | None = None,
) -> AlertEvent:
    event = AlertEvent(
        id=generate_id(),
        camera_id=camera_id,
        strategy_id=(strategy_id or "").strip() or None,
        strategy_name=(strategy_name or "").strip() or None,
        rule_id=rule_id,
        rule_name=rule_name,
        event_key=event_key,
        confidence=float(confidence),
        status=ALERT_STATUS_OPEN,
        message=message,
        media_id=media_id,
        payload=payload,
        occurred_at=ensure_aware(occurred_at or utcnow()),
        acked_at=None,
        resolved_at=None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    if dispatch_webhooks:
        if dispatch_webhooks_fn is not None:
            dispatch_webhooks_fn(db, event)
        if dispatch_notifications_fn is not None:
            dispatch_notifications_fn(db, event)
    return event
