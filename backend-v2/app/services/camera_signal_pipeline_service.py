from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.camera import CameraTriggerRule
from app.models.camera_signal import CameraRuleHitLog, CameraSignalState
from app.models.strategy import AnalysisStrategy
from app.schemas.camera import (
    CameraTriggerRuleDebugRead,
    CameraTriggerRuleDebugLiveRequest,
    CameraTriggerRuleDebugResult,
)
from app.services.alert_service import create_alert_event
from app.services.camera_capture_service import capture_camera_frame
from app.services.camera_roi_service import CameraRoiError, apply_analysis_roi_to_frame, extract_analysis_roi
from app.services.camera_media_service import capture_photo
from app.services.camera_service import get_camera_or_404
from app.services.camera_signal_monitor_service import get_camera_signal_monitor_config_or_create
from app.services.camera_trigger_rule_service import evaluate_camera_trigger_rule
from app.services.ids import generate_id
from app.services.model_call_log_service import build_model_call_details, create_model_call_log
from app.services.providers.base import ProviderRequest
from app.services.providers.factory import get_provider_adapter
from app.services.signal_extractor import extract_signals
from app.services.storage import FileStorageService
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404


def process_camera_cycle(camera_id: str, trigger_source: str = "signal_monitor") -> dict:
    with SessionLocal() as db:
        result = process_camera_signal_cycle(
            db,
            camera_id=camera_id,
            trigger_source=trigger_source,
            dry_run=False,
            capture_on_match=True,
            source_kind="trigger_rule_auto",
        )
        return result.model_dump()


def process_camera_signal_cycle(
    db: Session,
    *,
    camera_id: str,
    trigger_source: str,
    dry_run: bool = False,
    capture_on_match: bool = True,
    source_kind: str = "trigger_rule_auto",
    strategy_id: str | None = None,
    model_provider: str | None = None,
    model_name: str | None = None,
    rule_ids: list[str] | None = None,
) -> CameraTriggerRuleDebugRead:
    now = _utcnow()
    camera = get_camera_or_404(db, camera_id)
    strategy = _resolve_strategy(db, camera_id=camera.id, strategy_id=strategy_id)
    strategy_snapshot = build_strategy_snapshot(strategy)
    monitor_config = get_camera_signal_monitor_config_or_create(db, camera_id=camera.id)
    analysis_roi = extract_analysis_roi(monitor_config)

    frame = capture_camera_frame(camera)
    try:
        frame, _ = apply_analysis_roi_to_frame(frame, analysis_roi)
    except CameraRoiError as exc:
        raise ValueError(f"Signal monitor ROI crop failed: {exc}") from exc
    frame_path = FileStorageService(root=camera.storage_path or None).save_bytes(
        frame.content,
        frame.original_name,
        folder=f"signal-monitor/{camera.id}/frames",
    )

    adapter = get_provider_adapter(model_provider or strategy.model_provider)
    provider_response = adapter.analyze(
        ProviderRequest(
            model=model_name or strategy.model_name,
            prompt=strategy.prompt_template,
            image_paths=[frame_path],
            response_format=str(strategy.result_format or "json_schema"),
            response_schema=strategy.response_schema,
        )
    )
    create_model_call_log(
        db,
        provider=model_provider or strategy.model_provider,
        model_name=model_name or strategy.model_name,
        trigger_type="signal_monitor",
        trigger_source=trigger_source,
        response_format=str(strategy.result_format or "json_schema"),
        success=provider_response.success,
        error_message=provider_response.error_message,
        usage=provider_response.usage,
        input_image_count=1,
        camera_id=camera.id,
        strategy_id=strategy.id,
        details=build_model_call_details(
            prompt=str(strategy.prompt_template or ""),
            response_format=str(strategy.result_format or "json_schema"),
            image_paths=[frame_path],
            input_summary={
                "dry_run": dry_run,
                "trigger_source": trigger_source,
            },
            raw_response=provider_response.raw_response,
            normalized_json=provider_response.normalized_json,
            error_message=provider_response.error_message,
            context={
                "camera_id": camera.id,
                "strategy_id": strategy.id,
                "trigger_source": trigger_source,
            },
        ),
    )
    normalized_json = provider_response.normalized_json if isinstance(provider_response.normalized_json, dict) else {}
    signals = extract_signals(normalized_json=normalized_json, strategy_snapshot=strategy_snapshot)
    consecutive_hits = _build_consecutive_hits(
        db,
        camera_id=camera.id,
        signals=signals,
        now=now,
        persist=not dry_run,
    )

    stmt = (
        select(CameraTriggerRule)
        .where(CameraTriggerRule.camera_id == camera.id)
        .order_by(CameraTriggerRule.priority.asc(), CameraTriggerRule.created_at.asc(), CameraTriggerRule.id.asc())
    )
    rules = list(db.scalars(stmt))
    if rule_ids:
        allowed_ids = {item.strip() for item in rule_ids if item and item.strip()}
        rules = [rule for rule in rules if rule.id in allowed_ids]

    matched_count = 0
    debug_results: list[CameraTriggerRuleDebugResult] = []

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

        if evaluation.matched and not dry_run:
            rule.last_triggered_at = now
            if capture_on_match:
                capture_result = capture_photo(
                    db,
                    camera=camera,
                    source_kind=(source_kind or "trigger_rule_auto").strip() or "trigger_rule_auto",
                )
                if capture_result.success:
                    media = capture_result.media
                else:
                    error_message = capture_result.error_message

            alert_event = create_alert_event(
                db,
                camera_id=camera.id,
                strategy_id=strategy.id,
                strategy_name=strategy.name,
                rule_id=rule.id,
                rule_name=rule.name,
                event_key=evaluation.event_key,
                confidence=evaluation.confidence,
                message=f"触发规则[{rule.name}]命中：{evaluation.reason}",
                media_id=media.id if media is not None else None,
                payload={
                    "trigger_source": trigger_source,
                    "camera_name": camera.name,
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "signals": signals,
                    "normalized_json": normalized_json,
                    "expression_result": evaluation.expression_result,
                },
                occurred_at=now,
                dispatch_webhooks=True,
            )
            hit_log = CameraRuleHitLog(
                id=generate_id(),
                camera_id=camera.id,
                rule_id=rule.id,
                matched=True,
                event_key=evaluation.event_key,
                confidence=evaluation.confidence,
                required_confidence=evaluation.threshold,
                consecutive_hits=evaluation.consecutive_hits,
                required_consecutive_hits=evaluation.required_consecutive_hits,
                reason=evaluation.reason,
                signals=signals,
                expression_result=evaluation.expression_result,
                media_id=media.id if media is not None else None,
                alert_event_id=alert_event.id,
            )
            db.add(hit_log)

        debug_results.append(
            CameraTriggerRuleDebugResult(
                rule_id=rule.id,
                rule_name=rule.name,
                event_type=rule.event_type,
                event_key=evaluation.event_key,
                match_mode=(rule.match_mode or "simple").lower(),
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

    db.commit()

    return CameraTriggerRuleDebugRead(
        camera_id=camera.id,
        dry_run=dry_run,
        capture_on_match=capture_on_match,
        matched_count=matched_count,
        evaluated_at=_serialize_datetime(now) or now.isoformat(),
        detected_signals=signals,
        consecutive_hits=consecutive_hits,
        normalized_json=normalized_json,
        results=debug_results,
    )


def run_camera_signal_cycle_with_db(
    db: Session,
    *,
    camera_id: str,
    trigger_source: str,
    dry_run: bool,
    capture_on_match: bool,
    source_kind: str,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    model_name: str | None = None,
    rule_ids: list[str] | None = None,
    ) -> CameraTriggerRuleDebugRead:
    return process_camera_signal_cycle(
        db,
        camera_id=camera_id,
        trigger_source=trigger_source,
        dry_run=dry_run,
        capture_on_match=capture_on_match,
        source_kind=source_kind,
        strategy_id=strategy_id,
        model_provider=model_provider,
        model_name=model_name,
        rule_ids=rule_ids,
    )


def debug_camera_trigger_rules_live(
    db: Session,
    *,
    camera,
    payload: CameraTriggerRuleDebugLiveRequest,
) -> CameraTriggerRuleDebugRead:
    return process_camera_signal_cycle(
        db,
        camera_id=camera.id,
        trigger_source="debug_live",
        dry_run=payload.dry_run,
        capture_on_match=payload.capture_on_match,
        source_kind=payload.source_kind,
        strategy_id=payload.strategy_id,
        model_provider=payload.model_provider,
        model_name=payload.model_name,
        rule_ids=payload.rule_ids,
    )


def _resolve_strategy(db: Session, *, camera_id: str, strategy_id: str | None) -> AnalysisStrategy:
    if strategy_id:
        return get_strategy_or_404(db, strategy_id)

    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    if config.signal_strategy_id:
        return get_strategy_or_404(db, config.signal_strategy_id)

    fallback = db.get(AnalysisStrategy, "preset-fire")
    if fallback is not None:
        return fallback

    strategy = db.scalar(
        select(AnalysisStrategy)
        .where(AnalysisStrategy.status == "active")
        .order_by(AnalysisStrategy.created_at.desc(), AnalysisStrategy.id.asc())
    )
    if strategy is None:
        raise ValueError("No active strategy available for signal pipeline")
    return strategy


def _build_consecutive_hits(
    db: Session,
    *,
    camera_id: str,
    signals: dict[str, float],
    now: datetime,
    persist: bool,
) -> dict[str, int]:
    stmt = select(CameraSignalState).where(CameraSignalState.camera_id == camera_id)
    current_states = {state.signal_key: state for state in db.scalars(stmt)}
    consecutive_hits: dict[str, int] = {}

    for signal_key, confidence in signals.items():
        normalized_key = signal_key.strip().lower()
        previous = current_states.get(normalized_key)
        previous_hits = previous.consecutive_hits if previous is not None else 0
        next_hits = previous_hits + 1 if float(confidence or 0) > 0 else 0
        consecutive_hits[normalized_key] = next_hits

        if not persist:
            continue
        if previous is None:
            previous = CameraSignalState(
                id=generate_id(),
                camera_id=camera_id,
                signal_key=normalized_key,
                last_confidence=float(confidence or 0),
                consecutive_hits=next_hits,
                last_seen_at=now,
            )
            db.add(previous)
            current_states[normalized_key] = previous
            continue
        previous.last_confidence = float(confidence or 0)
        previous.consecutive_hits = next_hits
        previous.last_seen_at = now

    if persist:
        for signal_key, state in current_states.items():
            if signal_key in signals:
                continue
            state.last_confidence = 0.0
            state.consecutive_hits = 0
        db.flush()

    return consecutive_hits


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.astimezone(timezone.utc).isoformat()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
