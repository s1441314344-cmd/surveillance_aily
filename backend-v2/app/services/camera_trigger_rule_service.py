from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.camera import Camera, CameraTriggerRule
from app.schemas.camera import (
    CameraTriggerRuleCreate,
    CameraTriggerRuleDebugRead,
    CameraTriggerRuleDebugRequest,
    CameraTriggerRuleDebugResult,
    CameraTriggerRuleRead,
    CameraTriggerRuleUpdate,
)
from app.services.camera_media_service import capture_photo
from app.services.ids import generate_id
from app.services.rule_expression_evaluator import evaluate_expression

ALLOWED_EVENT_TYPES = {"person", "fire", "leak", "custom"}
ALLOWED_MATCH_MODES = {"simple", "expression"}


@dataclass
class CameraRuleEvaluation:
    rule: CameraTriggerRule
    event_key: str
    confidence: float
    threshold: float
    consecutive_hits: int
    required_consecutive_hits: int
    cooldown_ok: bool
    cooldown_remaining_seconds: int
    matched: bool
    reason: str
    expression_result: dict | None = None


def serialize_camera_trigger_rule(rule: CameraTriggerRule) -> CameraTriggerRuleRead:
    return CameraTriggerRuleRead(
        id=rule.id,
        camera_id=rule.camera_id,
        name=rule.name,
        event_type=rule.event_type,
        event_key=rule.event_key,
        match_mode=_normalize_match_mode(rule.match_mode),
        expression_json=rule.expression_json,
        priority=rule.priority or 100,
        action_policy_json=rule.action_policy_json,
        enabled=rule.enabled,
        min_confidence=rule.min_confidence,
        min_consecutive_frames=rule.min_consecutive_frames,
        cooldown_seconds=rule.cooldown_seconds,
        description=rule.description,
        last_triggered_at=_serialize_datetime(rule.last_triggered_at),
        created_at=_serialize_datetime(rule.created_at),
        updated_at=_serialize_datetime(rule.updated_at),
    )


def list_camera_trigger_rules(db: Session, *, camera_id: str) -> list[CameraTriggerRuleRead]:
    stmt = (
        select(CameraTriggerRule)
        .where(CameraTriggerRule.camera_id == camera_id)
        .order_by(CameraTriggerRule.priority.asc(), CameraTriggerRule.created_at.desc(), CameraTriggerRule.id.desc())
    )
    return [serialize_camera_trigger_rule(rule) for rule in db.scalars(stmt)]


def get_camera_trigger_rule_or_404(db: Session, *, camera_id: str, rule_id: str) -> CameraTriggerRule:
    rule = db.get(CameraTriggerRule, rule_id)
    if rule is None or rule.camera_id != camera_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera trigger rule not found")
    return rule


def create_camera_trigger_rule(
    db: Session,
    *,
    camera: Camera,
    payload: CameraTriggerRuleCreate,
) -> CameraTriggerRuleRead:
    match_mode = _normalize_match_mode(payload.match_mode)
    event_type = _normalize_event_type(payload.event_type)
    event_key = _resolve_event_key(event_type=event_type, event_key=payload.event_key)
    expression_json = _normalize_expression_json(match_mode=match_mode, expression_json=payload.expression_json)

    rule = CameraTriggerRule(
        id=generate_id(),
        camera_id=camera.id,
        name=payload.name.strip(),
        event_type=event_type,
        event_key=event_key,
        match_mode=match_mode,
        expression_json=expression_json,
        priority=int(payload.priority),
        action_policy_json=payload.action_policy_json if isinstance(payload.action_policy_json, dict) else None,
        enabled=payload.enabled,
        min_confidence=float(payload.min_confidence),
        min_consecutive_frames=int(payload.min_consecutive_frames),
        cooldown_seconds=int(payload.cooldown_seconds),
        description=(payload.description or "").strip() or None,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return serialize_camera_trigger_rule(rule)


def update_camera_trigger_rule(
    db: Session,
    *,
    rule: CameraTriggerRule,
    payload: CameraTriggerRuleUpdate,
) -> CameraTriggerRuleRead:
    updates = payload.model_dump(exclude_unset=True)
    next_event_type = _normalize_event_type(str(updates["event_type"])) if "event_type" in updates else rule.event_type
    next_event_key = updates["event_key"] if "event_key" in updates else rule.event_key
    resolved_event_key = _resolve_event_key(event_type=next_event_type, event_key=next_event_key)
    next_match_mode = _normalize_match_mode(str(updates.get("match_mode") or rule.match_mode))
    next_expression_json = _normalize_expression_json(
        match_mode=next_match_mode,
        expression_json=updates.get("expression_json", rule.expression_json),
    )

    for field_name, value in updates.items():
        if field_name in {"event_type", "event_key", "match_mode", "expression_json"}:
            continue
        if field_name == "name" and value is not None:
            value = str(value).strip()
            if not value:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Rule name is required")
        if field_name == "description" and value is not None:
            value = str(value).strip() or None
        setattr(rule, field_name, value)

    rule.event_type = next_event_type
    rule.event_key = resolved_event_key
    rule.match_mode = next_match_mode
    rule.expression_json = next_expression_json
    db.commit()
    db.refresh(rule)
    return serialize_camera_trigger_rule(rule)


def delete_camera_trigger_rule(db: Session, *, rule: CameraTriggerRule) -> dict[str, bool]:
    db.delete(rule)
    db.commit()
    return {"deleted": True}


def debug_camera_trigger_rules(
    db: Session,
    *,
    camera: Camera,
    payload: CameraTriggerRuleDebugRequest,
) -> CameraTriggerRuleDebugRead:
    stmt = (
        select(CameraTriggerRule)
        .where(CameraTriggerRule.camera_id == camera.id)
        .order_by(CameraTriggerRule.priority.asc(), CameraTriggerRule.created_at.asc(), CameraTriggerRule.id.asc())
    )
    rules = list(db.scalars(stmt))
    if payload.rule_ids:
        selected_rule_ids = {item.strip() for item in payload.rule_ids if item.strip()}
        rules = [rule for rule in rules if rule.id in selected_rule_ids]

    now = _utcnow()
    matched_count = 0
    wrote_state = False
    capture_consumed = False
    debug_results: list[CameraTriggerRuleDebugResult] = []
    signals = {_normalize_key(key): _coerce_float(value, default=0.0) for key, value in payload.signals.items()}
    consecutive_hits = {
        _normalize_key(key): _coerce_int(value, default=0)
        for key, value in payload.consecutive_hits.items()
    }

    for rule in rules:
        evaluation = evaluate_camera_trigger_rule(
            rule=rule,
            signals=signals,
            consecutive_hits=consecutive_hits,
            now=now,
        )
        media = None
        error_message = None

        if evaluation.matched:
            matched_count += 1
            if not payload.dry_run:
                rule.last_triggered_at = now
                wrote_state = True
                if payload.capture_on_match and not capture_consumed:
                    capture_result = capture_photo(
                        db,
                        camera=camera,
                        source_kind=(payload.source_kind or "trigger_rule").strip() or "trigger_rule",
                    )
                    if capture_result.success:
                        media = capture_result.media
                        capture_consumed = True
                    else:
                        error_message = capture_result.error_message

        debug_results.append(
            CameraTriggerRuleDebugResult(
                rule_id=rule.id,
                rule_name=rule.name,
                event_type=rule.event_type,
                event_key=evaluation.event_key,
                match_mode=_normalize_match_mode(rule.match_mode),
                enabled=rule.enabled,
                matched=evaluation.matched,
                confidence=evaluation.confidence,
                threshold=evaluation.threshold,
                consecutive_hits=evaluation.consecutive_hits,
                required_consecutive_hits=evaluation.required_consecutive_hits,
                cooldown_ok=evaluation.cooldown_ok,
                cooldown_remaining_seconds=evaluation.cooldown_remaining_seconds,
                reason=evaluation.reason,
                expression_result=evaluation.expression_result,
                media=media,
                error_message=error_message,
            )
        )

    if wrote_state and (not payload.capture_on_match or not capture_consumed):
        db.commit()

    return CameraTriggerRuleDebugRead(
        camera_id=camera.id,
        dry_run=payload.dry_run,
        capture_on_match=payload.capture_on_match,
        matched_count=matched_count,
        evaluated_at=_serialize_datetime(now) or now.isoformat(),
        detected_signals=signals,
        consecutive_hits=consecutive_hits,
        normalized_json=None,
        results=debug_results,
    )


def evaluate_camera_trigger_rules(
    db: Session,
    *,
    camera: Camera,
    payload: CameraTriggerRuleDebugRequest,
) -> CameraTriggerRuleDebugRead:
    return debug_camera_trigger_rules(db, camera=camera, payload=payload)


def evaluate_camera_trigger_rule(
    *,
    rule: CameraTriggerRule,
    signals: dict[str, float],
    consecutive_hits: dict[str, int],
    now: datetime | None = None,
) -> CameraRuleEvaluation:
    current_time = now or _utcnow()
    event_key = _normalize_key(rule.event_key or rule.event_type)
    confidence = _coerce_float(signals.get(event_key), default=0.0)
    consecutive = _coerce_int(consecutive_hits.get(event_key), default=0)
    cooldown_ok, cooldown_remaining_seconds = _evaluate_cooldown(rule=rule, now=current_time)

    if not rule.enabled:
        return CameraRuleEvaluation(
            rule=rule,
            event_key=event_key,
            confidence=confidence,
            threshold=float(rule.min_confidence),
            consecutive_hits=consecutive,
            required_consecutive_hits=int(rule.min_consecutive_frames),
            cooldown_ok=cooldown_ok,
            cooldown_remaining_seconds=cooldown_remaining_seconds,
            matched=False,
            reason="规则已禁用",
        )

    if not cooldown_ok:
        return CameraRuleEvaluation(
            rule=rule,
            event_key=event_key,
            confidence=confidence,
            threshold=float(rule.min_confidence),
            consecutive_hits=consecutive,
            required_consecutive_hits=int(rule.min_consecutive_frames),
            cooldown_ok=cooldown_ok,
            cooldown_remaining_seconds=cooldown_remaining_seconds,
            matched=False,
            reason=f"冷却中，剩余 {cooldown_remaining_seconds} 秒",
        )

    match_mode = _normalize_match_mode(rule.match_mode)
    if match_mode == "expression":
        result = evaluate_expression(
            rule.expression_json,
            signals=signals,
            consecutive_hits=consecutive_hits,
        )
        reason = "命中触发条件" if result.matched else f"表达式未命中：{result.reason}"
        return CameraRuleEvaluation(
            rule=rule,
            event_key=event_key,
            confidence=confidence,
            threshold=float(rule.min_confidence),
            consecutive_hits=consecutive,
            required_consecutive_hits=int(rule.min_consecutive_frames),
            cooldown_ok=cooldown_ok,
            cooldown_remaining_seconds=cooldown_remaining_seconds,
            matched=result.matched,
            reason=reason,
            expression_result={"matched": result.matched, "reason": result.reason},
        )

    if confidence < rule.min_confidence:
        return CameraRuleEvaluation(
            rule=rule,
            event_key=event_key,
            confidence=confidence,
            threshold=float(rule.min_confidence),
            consecutive_hits=consecutive,
            required_consecutive_hits=int(rule.min_consecutive_frames),
            cooldown_ok=cooldown_ok,
            cooldown_remaining_seconds=cooldown_remaining_seconds,
            matched=False,
            reason=f"置信度不足：{confidence:.3f} < {rule.min_confidence:.3f}",
        )

    if consecutive < rule.min_consecutive_frames:
        return CameraRuleEvaluation(
            rule=rule,
            event_key=event_key,
            confidence=confidence,
            threshold=float(rule.min_confidence),
            consecutive_hits=consecutive,
            required_consecutive_hits=int(rule.min_consecutive_frames),
            cooldown_ok=cooldown_ok,
            cooldown_remaining_seconds=cooldown_remaining_seconds,
            matched=False,
            reason=f"连续帧不足：{consecutive} < {rule.min_consecutive_frames}",
        )

    return CameraRuleEvaluation(
        rule=rule,
        event_key=event_key,
        confidence=confidence,
        threshold=float(rule.min_confidence),
        consecutive_hits=consecutive,
        required_consecutive_hits=int(rule.min_consecutive_frames),
        cooldown_ok=cooldown_ok,
        cooldown_remaining_seconds=cooldown_remaining_seconds,
        matched=True,
        reason="命中触发条件",
    )


def _normalize_event_type(raw_value: str) -> str:
    event_type = (raw_value or "").strip().lower()
    if event_type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported event_type: {raw_value}",
        )
    return event_type


def _normalize_match_mode(raw_value: str | None) -> str:
    normalized = (raw_value or "simple").strip().lower()
    if normalized not in ALLOWED_MATCH_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported match_mode: {raw_value}",
        )
    return normalized


def _normalize_expression_json(*, match_mode: str, expression_json: dict | None) -> dict | None:
    if match_mode != "expression":
        return expression_json if isinstance(expression_json, dict) else None
    if not isinstance(expression_json, dict) or not expression_json:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expression_json is required when match_mode is expression",
        )
    return expression_json


def _resolve_event_key(*, event_type: str, event_key: str | None) -> str:
    normalized_key = _normalize_key(event_key)
    if normalized_key:
        return normalized_key
    if event_type == "custom":
        return "expression"
    return event_type


def _evaluate_cooldown(*, rule: CameraTriggerRule, now: datetime) -> tuple[bool, int]:
    if not rule.last_triggered_at or rule.cooldown_seconds <= 0:
        return True, 0
    last_triggered_at = _to_utc(rule.last_triggered_at)
    elapsed = int((now - last_triggered_at).total_seconds())
    remaining = max(rule.cooldown_seconds - elapsed, 0)
    return remaining == 0, remaining


def _normalize_key(value: str | None) -> str:
    return (value or "").strip().lower()


def _coerce_float(value, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value, *, default: int) -> int:
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return default


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _to_utc(value).isoformat()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
