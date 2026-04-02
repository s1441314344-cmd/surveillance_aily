from __future__ import annotations

import json
import subprocess
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
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
    AlertFeishuChatCandidate,
    AlertFeishuChatSearchResponse,
    AlertFeishuUserCandidate,
    AlertFeishuUserSearchResponse,
    AlertNotificationRouteCreate,
    AlertNotificationRouteRead,
    AlertNotificationRouteUpdate,
    AlertWebhookCreate,
    AlertWebhookDeliveryRead,
    AlertWebhookRead,
    AlertWebhookUpdate,
)
from app.services.ids import generate_id
from app.services.strategy_service import get_strategy_or_404

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
ALERT_NOTIFICATION_RECIPIENT_TYPES = {"user", "chat"}

settings = get_settings()


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


def serialize_alert_notification_route(
    item: AlertNotificationRoute,
    *,
    strategy_name: str | None = None,
) -> AlertNotificationRouteRead:
    return AlertNotificationRouteRead(
        id=item.id,
        name=item.name,
        strategy_id=item.strategy_id,
        strategy_name=strategy_name,
        event_key=item.event_key,
        severity=item.severity,
        camera_id=item.camera_id,
        recipient_type=item.recipient_type,
        recipient_id=item.recipient_id,
        enabled=bool(item.enabled),
        priority=int(item.priority or 0),
        cooldown_seconds=int(item.cooldown_seconds or 0),
        message_template=item.message_template,
        last_error=item.last_error,
        last_delivered_at=_serialize_datetime(item.last_delivered_at),
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
        occurred_at=_ensure_aware(occurred_at or _utcnow()),
        acked_at=None,
        resolved_at=None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    if dispatch_webhooks:
        dispatch_alert_webhooks(db, event=event)
        dispatch_alert_notifications(db, event=event)
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


def list_alert_notification_routes(
    db: Session,
    *,
    strategy_id: str | None = None,
    enabled: bool | None = None,
) -> list[AlertNotificationRouteRead]:
    stmt = select(AlertNotificationRoute).order_by(
        AlertNotificationRoute.priority.asc(),
        AlertNotificationRoute.created_at.asc(),
        AlertNotificationRoute.id.asc(),
    )
    if strategy_id is not None:
        normalized_strategy_id = strategy_id.strip()
        if normalized_strategy_id:
            stmt = stmt.where(AlertNotificationRoute.strategy_id == normalized_strategy_id)
    if enabled is not None:
        stmt = stmt.where(AlertNotificationRoute.enabled.is_(enabled))

    routes = list(db.scalars(stmt))
    strategy_name_map = _build_strategy_name_map(db, [item.strategy_id for item in routes])
    return [
        serialize_alert_notification_route(item, strategy_name=strategy_name_map.get(item.strategy_id))
        for item in routes
    ]


def get_alert_notification_route_or_404(db: Session, route_id: str) -> AlertNotificationRoute:
    route = db.get(AlertNotificationRoute, route_id)
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert notification route not found")
    return route


def create_alert_notification_route(
    db: Session,
    *,
    payload: AlertNotificationRouteCreate,
) -> AlertNotificationRouteRead:
    strategy_id, strategy_name = _resolve_route_strategy(db, payload.strategy_id)
    route = AlertNotificationRoute(
        id=generate_id(),
        name=_normalize_required_text(payload.name, field_name="name"),
        strategy_id=strategy_id,
        event_key=_normalize_optional_text(payload.event_key, lowercase=True),
        severity=_normalize_optional_text(payload.severity, lowercase=True),
        camera_id=_normalize_optional_text(payload.camera_id),
        recipient_type=_normalize_route_recipient_type(payload.recipient_type),
        recipient_id=_normalize_required_text(payload.recipient_id, field_name="recipient_id"),
        enabled=bool(payload.enabled),
        priority=int(payload.priority),
        cooldown_seconds=int(payload.cooldown_seconds),
        message_template=_normalize_optional_text(payload.message_template),
        last_error=None,
        last_delivered_at=None,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return serialize_alert_notification_route(route, strategy_name=strategy_name)


def update_alert_notification_route(
    db: Session,
    *,
    route: AlertNotificationRoute,
    payload: AlertNotificationRouteUpdate,
) -> AlertNotificationRouteRead:
    updates = payload.model_dump(exclude_unset=True)

    if "strategy_id" in updates:
        strategy_id, _strategy_name = _resolve_route_strategy(db, updates.get("strategy_id"))
        route.strategy_id = strategy_id

    if "name" in updates:
        route.name = _normalize_required_text(updates["name"], field_name="name")

    if "event_key" in updates:
        route.event_key = _normalize_optional_text(updates["event_key"], lowercase=True)

    if "severity" in updates:
        route.severity = _normalize_optional_text(updates["severity"], lowercase=True)

    if "camera_id" in updates:
        route.camera_id = _normalize_optional_text(updates["camera_id"])

    if "recipient_type" in updates:
        route.recipient_type = _normalize_route_recipient_type(updates["recipient_type"])

    if "recipient_id" in updates:
        route.recipient_id = _normalize_required_text(updates["recipient_id"], field_name="recipient_id")

    if "enabled" in updates:
        route.enabled = bool(updates["enabled"])

    if "priority" in updates:
        route.priority = int(updates["priority"])

    if "cooldown_seconds" in updates:
        route.cooldown_seconds = int(updates["cooldown_seconds"])

    if "message_template" in updates:
        route.message_template = _normalize_optional_text(updates["message_template"])

    db.commit()
    db.refresh(route)
    strategy_name_map = _build_strategy_name_map(db, [route.strategy_id])
    return serialize_alert_notification_route(route, strategy_name=strategy_name_map.get(route.strategy_id))


def search_lark_users_for_alert_routes(
    *,
    keyword: str,
    limit: int = 20,
    page_token: str | None = None,
) -> AlertFeishuUserSearchResponse:
    normalized_keyword = _normalize_optional_text(keyword)
    if normalized_keyword is None:
        return AlertFeishuUserSearchResponse(items=[], has_more=False, page_token=None)

    safe_limit = min(max(int(limit or 20), 1), 100)
    command = [
        settings.alert_lark_cli_bin,
        "contact",
        "+search-user",
        "--as",
        "user",
        "--query",
        normalized_keyword,
        "--page-size",
        str(safe_limit),
        "--format",
        "json",
    ]
    normalized_page_token = _normalize_optional_text(page_token)
    if normalized_page_token:
        command.extend(["--page-token", normalized_page_token])

    payload = _run_lark_cli_json(command, purpose="search lark users")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    rows = data.get("users") if isinstance(data.get("users"), list) else []

    items: list[AlertFeishuUserCandidate] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        open_id = _normalize_optional_text(row.get("open_id"))
        if not open_id:
            continue
        user_id = _normalize_optional_text(row.get("user_id"))
        employee_id = _normalize_optional_text(
            row.get("employee_id") or row.get("employee_no") or row.get("employee_number")
        )
        avatar = row.get("avatar") if isinstance(row.get("avatar"), dict) else {}
        avatar_url = _normalize_optional_text(
            avatar.get("avatar_origin") or row.get("avatar_url") or row.get("avatar")
        )
        department_ids = [
            str(item).strip()
            for item in (row.get("department_ids") if isinstance(row.get("department_ids"), list) else [])
            if str(item).strip()
        ]
        name = _normalize_optional_text(row.get("name")) or open_id
        items.append(
            AlertFeishuUserCandidate(
                id=open_id,
                open_id=open_id,
                user_id=user_id,
                employee_id=employee_id,
                name=name,
                avatar_url=avatar_url,
                department_ids=department_ids,
            )
        )

    return AlertFeishuUserSearchResponse(
        items=items,
        has_more=bool(data.get("has_more")),
        page_token=_normalize_optional_text(data.get("page_token")),
    )


def search_lark_chats_for_alert_routes(
    *,
    keyword: str | None = None,
    limit: int = 20,
    page_token: str | None = None,
) -> AlertFeishuChatSearchResponse:
    normalized_keyword = _normalize_optional_text(keyword)
    safe_limit = min(max(int(limit or 20), 1), 100)
    normalized_page_token = _normalize_optional_text(page_token)

    if normalized_keyword:
        command = [
            settings.alert_lark_cli_bin,
            "im",
            "+chat-search",
            "--as",
            "bot",
            "--query",
            normalized_keyword,
            "--page-size",
            str(safe_limit),
            "--format",
            "json",
        ]
        if normalized_page_token:
            command.extend(["--page-token", normalized_page_token])
    else:
        params_payload: dict[str, str | int] = {"page_size": safe_limit}
        if normalized_page_token:
            params_payload["page_token"] = normalized_page_token
        command = [
            settings.alert_lark_cli_bin,
            "im",
            "chats",
            "list",
            "--as",
            "bot",
            "--params",
            json.dumps(params_payload, ensure_ascii=False),
            "--format",
            "json",
        ]

    payload = _run_lark_cli_json(command, purpose="search lark chats")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    rows = data.get("chats") if isinstance(data.get("chats"), list) else data.get("items")
    chats = rows if isinstance(rows, list) else []

    items: list[AlertFeishuChatCandidate] = []
    for row in chats:
        if not isinstance(row, dict):
            continue
        chat_id = _normalize_optional_text(row.get("chat_id"))
        if not chat_id:
            continue
        name = _normalize_optional_text(row.get("name")) or chat_id
        items.append(
            AlertFeishuChatCandidate(
                id=chat_id,
                chat_id=chat_id,
                name=name,
                avatar_url=_normalize_optional_text(row.get("avatar")),
                description=_normalize_optional_text(row.get("description")),
                owner_open_id=_normalize_optional_text(row.get("owner_id")),
                external=bool(row.get("external")),
            )
        )

    return AlertFeishuChatSearchResponse(
        items=items,
        has_more=bool(data.get("has_more")),
        page_token=_normalize_optional_text(data.get("page_token")),
    )


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


def dispatch_alert_notifications(
    db: Session,
    *,
    event: AlertEvent,
) -> list[str]:
    if not settings.alert_lark_notify_enabled:
        return []

    strategy_id = _resolve_event_strategy_id(event)
    severity = _infer_alert_severity(event)
    now = _utcnow()
    routes = list(
        db.scalars(
            select(AlertNotificationRoute)
            .where(AlertNotificationRoute.enabled.is_(True))
            .order_by(
                AlertNotificationRoute.priority.asc(),
                AlertNotificationRoute.created_at.asc(),
                AlertNotificationRoute.id.asc(),
            )
        )
    )
    if not routes:
        return []

    strategy_name_map = _build_strategy_name_map(db, [item.strategy_id for item in routes])
    delivered_ids: list[str] = []
    has_updates = False

    for route in routes:
        if not _route_matches_event(
            route=route,
            event=event,
            strategy_id=strategy_id,
            severity=severity,
        ):
            continue
        if _route_is_in_cooldown(route=route, now=now):
            continue

        message_text = _render_alert_notification_message(
            route=route,
            event=event,
            strategy_id=strategy_id,
            strategy_name=strategy_name_map.get(route.strategy_id) or event.strategy_name,
            severity=severity,
        )
        success, error_message = _send_alert_message_with_lark_cli(
            route=route,
            message_text=message_text,
            event_id=event.id,
        )
        has_updates = True
        if success:
            route.last_error = None
            route.last_delivered_at = now
            delivered_ids.append(route.id)
            continue
        route.last_error = error_message

    if has_updates:
        db.commit()
    return delivered_ids


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


def _build_strategy_name_map(db: Session, strategy_ids: list[str | None]) -> dict[str | None, str]:
    ids = [item for item in {strategy_id for strategy_id in strategy_ids if strategy_id}]
    if not ids:
        return {}
    from app.models.strategy import AnalysisStrategy  # local import to avoid circular import

    rows = list(
        db.execute(
            select(AnalysisStrategy.id, AnalysisStrategy.name).where(AnalysisStrategy.id.in_(ids))
        )
    )
    return {strategy_id: name for strategy_id, name in rows}


def _resolve_route_strategy(db: Session, strategy_id: str | None) -> tuple[str | None, str | None]:
    normalized_strategy_id = _normalize_optional_text(strategy_id)
    if normalized_strategy_id is None:
        return None, None
    strategy = get_strategy_or_404(db, normalized_strategy_id)
    return strategy.id, strategy.name


def _normalize_required_text(value: str | None, *, field_name: str) -> str:
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} is required",
        )
    normalized = str(value).strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} is required",
        )
    return normalized


def _normalize_optional_text(value: str | None, *, lowercase: bool = False) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if lowercase:
        return normalized.lower()
    return normalized


def _normalize_route_recipient_type(value: str | None) -> str:
    normalized = _normalize_required_text(value, field_name="recipient_type").lower()
    if normalized not in ALERT_NOTIFICATION_RECIPIENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported recipient_type: {normalized}",
        )
    return normalized


def _resolve_event_strategy_id(event: AlertEvent) -> str | None:
    if event.strategy_id:
        return str(event.strategy_id).strip() or None
    payload = event.payload if isinstance(event.payload, dict) else {}
    strategy_id = payload.get("strategy_id")
    if not isinstance(strategy_id, str):
        return None
    return strategy_id.strip() or None


def _resolve_event_camera_name(event: AlertEvent) -> str | None:
    payload = event.payload if isinstance(event.payload, dict) else {}
    camera_name = payload.get("camera_name")
    if not isinstance(camera_name, str):
        return None
    return camera_name.strip() or None


def _route_matches_event(
    *,
    route: AlertNotificationRoute,
    event: AlertEvent,
    strategy_id: str | None,
    severity: str,
) -> bool:
    if route.strategy_id and route.strategy_id != strategy_id:
        return False
    if route.camera_id and route.camera_id != event.camera_id:
        return False
    if route.event_key and route.event_key != event.event_key:
        return False
    if route.severity and route.severity != severity:
        return False
    return True


def _route_is_in_cooldown(*, route: AlertNotificationRoute, now: datetime) -> bool:
    if int(route.cooldown_seconds or 0) <= 0 or route.last_delivered_at is None:
        return False
    elapsed = (now - _ensure_aware(route.last_delivered_at)).total_seconds()
    return elapsed < int(route.cooldown_seconds or 0)


def _render_alert_notification_message(
    *,
    route: AlertNotificationRoute,
    event: AlertEvent,
    strategy_id: str | None,
    strategy_name: str | None,
    severity: str,
) -> str:
    occurred_at = _serialize_datetime(event.occurred_at) or "-"
    confidence = float(event.confidence or 0)
    camera_name = _resolve_event_camera_name(event)
    default_message = (
        f"【智能巡检告警】{event.event_key} ({severity})\n"
        f"摄像头: {camera_name or event.camera_id}\n"
        f"策略: {strategy_name or strategy_id or '-'}\n"
        f"置信度: {confidence:.2f}\n"
        f"时间: {occurred_at}\n"
        f"详情: {event.message or '-'}\n"
        f"告警ID: {event.id}"
    )
    if not route.message_template:
        return default_message

    context = {
        "alert_id": event.id,
        "event_key": event.event_key,
        "severity": severity,
        "camera_id": event.camera_id,
        "camera_name": camera_name or "",
        "strategy_id": strategy_id or "",
        "strategy_name": strategy_name or "",
        "confidence": f"{confidence:.2f}",
        "occurred_at": occurred_at,
        "title": event.rule_name or event.event_key,
        "message": event.message or "",
    }
    try:
        rendered = route.message_template.format_map(context)
    except Exception:
        return default_message
    return rendered.strip() or default_message


def _run_lark_cli_json(command: list[str], *, purpose: str) -> dict:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=max(int(settings.alert_lark_cli_timeout_seconds), 1),
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Lark CLI unavailable: {settings.alert_lark_cli_bin}",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Lark CLI timeout while trying to {purpose}",
        ) from exc
    except Exception as exc:  # pragma: no cover - OS/runtime specific
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark CLI failed while trying to {purpose}: {str(exc)[:300]}",
        ) from exc

    raw_stdout = (result.stdout or "").strip()
    raw_stderr = (result.stderr or "").strip()
    if result.returncode != 0:
        raw_error = raw_stderr or raw_stdout or f"exit code {result.returncode}"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark CLI failed while trying to {purpose}: {raw_error[:500]}",
        )

    try:
        payload = json.loads(raw_stdout or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark CLI returned invalid JSON while trying to {purpose}",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark CLI returned invalid payload while trying to {purpose}",
        )

    if payload.get("ok") is False:
        error_payload = payload.get("error") if isinstance(payload.get("error"), dict) else {}
        error_message = _normalize_optional_text(error_payload.get("message")) or _normalize_optional_text(
            payload.get("msg")
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark CLI failed while trying to {purpose}: {(error_message or 'unknown error')[:500]}",
        )

    if isinstance(payload.get("code"), int) and int(payload.get("code")) != 0:
        error_message = _normalize_optional_text(payload.get("msg")) or "unknown error"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark API failed while trying to {purpose}: {error_message[:500]}",
        )

    return payload


def _send_alert_message_with_lark_cli(
    *,
    route: AlertNotificationRoute,
    message_text: str,
    event_id: str,
) -> tuple[bool, str | None]:
    recipient_flag = "--user-id" if route.recipient_type == "user" else "--chat-id"
    command = [
        settings.alert_lark_cli_bin,
        "im",
        "+messages-send",
        "--as",
        "bot",
        recipient_flag,
        route.recipient_id,
        "--text",
        message_text,
        "--idempotency-key",
        f"alert-{event_id}-{route.id}",
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=max(int(settings.alert_lark_cli_timeout_seconds), 1),
            check=False,
        )
    except FileNotFoundError:
        return False, f"command not found: {settings.alert_lark_cli_bin}"
    except subprocess.TimeoutExpired:
        return False, "lark-cli send timeout"
    except Exception as exc:  # pragma: no cover - OS/runtime specific
        return False, str(exc)

    if result.returncode == 0:
        return True, None

    raw_error = (result.stderr or result.stdout or "").strip()
    return False, (raw_error or f"lark-cli exited with {result.returncode}")[:1000]


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
