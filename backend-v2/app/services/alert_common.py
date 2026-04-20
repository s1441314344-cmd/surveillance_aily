from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.alert import AlertEvent

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


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return ensure_aware(value).isoformat()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_required_text(value: str | None, *, field_name: str) -> str:
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


def normalize_optional_text(value: str | None, *, lowercase: bool = False) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if lowercase:
        return normalized.lower()
    return normalized


def normalize_alert_status_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    return ALERT_STATUS_FILTER_ALIASES.get(normalized, normalized)


def normalize_alert_severity_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    return normalized if normalized in ALERT_SEVERITY_LEVELS else None


def normalize_keyword_filter(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def infer_alert_severity(item: AlertEvent) -> str:
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


def alert_event_contains_keyword(item: AlertEvent, keyword: str) -> bool:
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


def resolve_event_strategy_id(event: AlertEvent) -> str | None:
    if event.strategy_id:
        return str(event.strategy_id).strip() or None
    payload = event.payload if isinstance(event.payload, dict) else {}
    strategy_id = payload.get("strategy_id")
    if not isinstance(strategy_id, str):
        return None
    return strategy_id.strip() or None


def resolve_event_camera_name(event: AlertEvent) -> str | None:
    payload = event.payload if isinstance(event.payload, dict) else {}
    camera_name = payload.get("camera_name")
    if not isinstance(camera_name, str):
        return None
    return camera_name.strip() or None


def validate_webhook_status(value: str) -> None:
    if value not in VALID_ALERT_WEBHOOK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported webhook status: {value}",
        )


def resolve_webhook_status(
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


def resolve_webhook_url(
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
