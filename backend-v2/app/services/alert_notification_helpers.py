from __future__ import annotations

import json
import subprocess
from collections.abc import Callable
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import AlertEvent, AlertNotificationRoute
from app.schemas.alert import (
    AlertFeishuChatCandidate,
    AlertFeishuChatSearchResponse,
    AlertFeishuUserCandidate,
    AlertFeishuUserSearchResponse,
    AlertNotificationRouteCreate,
    AlertNotificationRouteRead,
    AlertNotificationRouteUpdate,
)
from app.services.alert_common import (
    ALERT_NOTIFICATION_RECIPIENT_TYPES,
    ensure_aware,
    infer_alert_severity,
    normalize_optional_text,
    normalize_required_text,
    resolve_event_camera_name,
    resolve_event_strategy_id,
    serialize_datetime,
    utcnow,
)
from app.services.ids import generate_id
from app.services.strategy_service import get_strategy_or_404

SubprocessRunFn = Callable[..., object]


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
        last_delivered_at=serialize_datetime(item.last_delivered_at),
        created_at=serialize_datetime(item.created_at),
        updated_at=serialize_datetime(item.updated_at),
    )


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
        name=normalize_required_text(payload.name, field_name="name"),
        strategy_id=strategy_id,
        event_key=normalize_optional_text(payload.event_key, lowercase=True),
        severity=normalize_optional_text(payload.severity, lowercase=True),
        camera_id=normalize_optional_text(payload.camera_id),
        recipient_type=_normalize_route_recipient_type(payload.recipient_type),
        recipient_id=normalize_required_text(payload.recipient_id, field_name="recipient_id"),
        enabled=bool(payload.enabled),
        priority=int(payload.priority),
        cooldown_seconds=int(payload.cooldown_seconds),
        message_template=normalize_optional_text(payload.message_template),
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
        route.name = normalize_required_text(updates["name"], field_name="name")

    if "event_key" in updates:
        route.event_key = normalize_optional_text(updates["event_key"], lowercase=True)

    if "severity" in updates:
        route.severity = normalize_optional_text(updates["severity"], lowercase=True)

    if "camera_id" in updates:
        route.camera_id = normalize_optional_text(updates["camera_id"])

    if "recipient_type" in updates:
        route.recipient_type = _normalize_route_recipient_type(updates["recipient_type"])

    if "recipient_id" in updates:
        route.recipient_id = normalize_required_text(updates["recipient_id"], field_name="recipient_id")

    if "enabled" in updates:
        route.enabled = bool(updates["enabled"])

    if "priority" in updates:
        route.priority = int(updates["priority"])

    if "cooldown_seconds" in updates:
        route.cooldown_seconds = int(updates["cooldown_seconds"])

    if "message_template" in updates:
        route.message_template = normalize_optional_text(updates["message_template"])

    db.commit()
    db.refresh(route)
    strategy_name_map = _build_strategy_name_map(db, [route.strategy_id])
    return serialize_alert_notification_route(route, strategy_name=strategy_name_map.get(route.strategy_id))


def search_lark_users_for_alert_routes(
    *,
    keyword: str,
    limit: int = 20,
    page_token: str | None = None,
    settings_obj,
    subprocess_run: SubprocessRunFn,
) -> AlertFeishuUserSearchResponse:
    normalized_keyword = normalize_optional_text(keyword)
    if normalized_keyword is None:
        return AlertFeishuUserSearchResponse(items=[], has_more=False, page_token=None)

    safe_limit = min(max(int(limit or 20), 1), 100)
    command = [
        settings_obj.alert_lark_cli_bin,
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
    normalized_page_token = normalize_optional_text(page_token)
    if normalized_page_token:
        command.extend(["--page-token", normalized_page_token])

    payload = _run_lark_cli_json(
        command,
        purpose="search lark users",
        settings_obj=settings_obj,
        subprocess_run=subprocess_run,
    )
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    rows = data.get("users") if isinstance(data.get("users"), list) else []

    items: list[AlertFeishuUserCandidate] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        open_id = normalize_optional_text(row.get("open_id"))
        if not open_id:
            continue
        user_id = normalize_optional_text(row.get("user_id"))
        employee_id = normalize_optional_text(
            row.get("employee_id") or row.get("employee_no") or row.get("employee_number")
        )
        avatar = row.get("avatar") if isinstance(row.get("avatar"), dict) else {}
        avatar_url = normalize_optional_text(avatar.get("avatar_origin") or row.get("avatar_url") or row.get("avatar"))
        department_ids = [
            str(item).strip()
            for item in (row.get("department_ids") if isinstance(row.get("department_ids"), list) else [])
            if str(item).strip()
        ]
        name = normalize_optional_text(row.get("name")) or open_id
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
        page_token=normalize_optional_text(data.get("page_token")),
    )


def search_lark_chats_for_alert_routes(
    *,
    keyword: str | None = None,
    limit: int = 20,
    page_token: str | None = None,
    settings_obj,
    subprocess_run: SubprocessRunFn,
) -> AlertFeishuChatSearchResponse:
    normalized_keyword = normalize_optional_text(keyword)
    safe_limit = min(max(int(limit or 20), 1), 100)
    normalized_page_token = normalize_optional_text(page_token)

    if normalized_keyword:
        command = [
            settings_obj.alert_lark_cli_bin,
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
            settings_obj.alert_lark_cli_bin,
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

    payload = _run_lark_cli_json(
        command,
        purpose="search lark chats",
        settings_obj=settings_obj,
        subprocess_run=subprocess_run,
    )
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    rows = data.get("chats") if isinstance(data.get("chats"), list) else data.get("items")
    chats = rows if isinstance(rows, list) else []

    items: list[AlertFeishuChatCandidate] = []
    for row in chats:
        if not isinstance(row, dict):
            continue
        chat_id = normalize_optional_text(row.get("chat_id"))
        if not chat_id:
            continue
        name = normalize_optional_text(row.get("name")) or chat_id
        items.append(
            AlertFeishuChatCandidate(
                id=chat_id,
                chat_id=chat_id,
                name=name,
                avatar_url=normalize_optional_text(row.get("avatar")),
                description=normalize_optional_text(row.get("description")),
                owner_open_id=normalize_optional_text(row.get("owner_id")),
                external=bool(row.get("external")),
            )
        )

    return AlertFeishuChatSearchResponse(
        items=items,
        has_more=bool(data.get("has_more")),
        page_token=normalize_optional_text(data.get("page_token")),
    )


def dispatch_alert_notifications(
    db: Session,
    *,
    event: AlertEvent,
    settings_obj,
    subprocess_run: SubprocessRunFn,
) -> list[str]:
    if not settings_obj.alert_lark_notify_enabled:
        return []

    strategy_id = resolve_event_strategy_id(event)
    severity = infer_alert_severity(event)
    now = utcnow()
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
            settings_obj=settings_obj,
            subprocess_run=subprocess_run,
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


def _build_strategy_name_map(db: Session, strategy_ids: list[str | None]) -> dict[str | None, str]:
    ids = [item for item in {strategy_id for strategy_id in strategy_ids if strategy_id}]
    if not ids:
        return {}
    from app.models.strategy import AnalysisStrategy  # local import to avoid circular import

    rows = list(db.execute(select(AnalysisStrategy.id, AnalysisStrategy.name).where(AnalysisStrategy.id.in_(ids))))
    return {strategy_id: name for strategy_id, name in rows}


def _resolve_route_strategy(db: Session, strategy_id: str | None) -> tuple[str | None, str | None]:
    normalized_strategy_id = normalize_optional_text(strategy_id)
    if normalized_strategy_id is None:
        return None, None
    strategy = get_strategy_or_404(db, normalized_strategy_id)
    return strategy.id, strategy.name


def _normalize_route_recipient_type(value: str | None) -> str:
    normalized = normalize_required_text(value, field_name="recipient_type").lower()
    if normalized not in ALERT_NOTIFICATION_RECIPIENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported recipient_type: {normalized}",
        )
    return normalized


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
    elapsed = (now - ensure_aware(route.last_delivered_at)).total_seconds()
    return elapsed < int(route.cooldown_seconds or 0)


def _render_alert_notification_message(
    *,
    route: AlertNotificationRoute,
    event: AlertEvent,
    strategy_id: str | None,
    strategy_name: str | None,
    severity: str,
) -> str:
    occurred_at = serialize_datetime(event.occurred_at) or "-"
    confidence = float(event.confidence or 0)
    camera_name = resolve_event_camera_name(event)
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


def _run_lark_cli_json(
    command: list[str],
    *,
    purpose: str,
    settings_obj,
    subprocess_run: SubprocessRunFn,
) -> dict:
    try:
        result = subprocess_run(
            command,
            capture_output=True,
            text=True,
            timeout=max(int(settings_obj.alert_lark_cli_timeout_seconds), 1),
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Lark CLI unavailable: {settings_obj.alert_lark_cli_bin}",
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
        error_message = normalize_optional_text(error_payload.get("message")) or normalize_optional_text(payload.get("msg"))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lark CLI failed while trying to {purpose}: {(error_message or 'unknown error')[:500]}",
        )

    if isinstance(payload.get("code"), int) and int(payload.get("code")) != 0:
        error_message = normalize_optional_text(payload.get("msg")) or "unknown error"
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
    settings_obj,
    subprocess_run: SubprocessRunFn,
) -> tuple[bool, str | None]:
    recipient_flag = "--user-id" if route.recipient_type == "user" else "--chat-id"
    command = [
        settings_obj.alert_lark_cli_bin,
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
        result = subprocess_run(
            command,
            capture_output=True,
            text=True,
            timeout=max(int(settings_obj.alert_lark_cli_timeout_seconds), 1),
            check=False,
        )
    except FileNotFoundError:
        return False, f"command not found: {settings_obj.alert_lark_cli_bin}"
    except subprocess.TimeoutExpired:
        return False, "lark-cli send timeout"
    except Exception as exc:  # pragma: no cover - OS/runtime specific
        return False, str(exc)

    if result.returncode == 0:
        return True, None

    raw_error = (result.stderr or result.stdout or "").strip()
    return False, (raw_error or f"lark-cli exited with {result.returncode}")[:1000]
