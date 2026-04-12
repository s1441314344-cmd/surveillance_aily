from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.camera import Camera, CameraTriggerRule
from app.models.strategy import AnalysisStrategy
from app.services.camera_roi_service import extract_analysis_roi
from app.services.camera_signal_monitor_service import (
    advance_monitor_schedule,
    get_camera_signal_monitor_config_or_create,
    list_due_monitor_configs,
    mark_monitor_error,
)
from app.services.local_detector_service import LocalDetectorError, detect_with_local_detector
from app.services.scheduler_common import ensure_aware, infer_expected_signal_keys, settings
from app.services.scheduler_signal_monitor_sweep_service import process_due_monitor_config
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404
from app.services.task_dispatcher import dispatch_signal_monitor_cycle


def run_due_signal_monitors_once(
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    with SessionLocal() as db:
        return run_due_signal_monitors_once_with_db(db, now=now, dispatch_jobs=dispatch_jobs)


def run_due_signal_monitors_once_with_db(
    db: Session,
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    current_time = ensure_aware(now or datetime.now(timezone.utc))
    due_configs = list_due_monitor_configs(db, now=current_time)
    processed_camera_ids: list[str] = []
    should_dispatch = settings.celery_enabled if dispatch_jobs is None else dispatch_jobs

    for config in due_configs:
        processed = process_due_monitor_config(
            db=db,
            config=config,
            current_time=current_time,
            should_dispatch=should_dispatch,
            run_local_gate=_run_signal_monitor_local_gate,
            advance_schedule=advance_monitor_schedule,
            mark_error=mark_monitor_error,
            dispatch_cycle=dispatch_signal_monitor_cycle,
        )
        if processed:
            processed_camera_ids.append(config.camera_id)

    return processed_camera_ids


def _run_signal_monitor_local_gate(
    *,
    db: Session,
    camera_id: str,
    strategy_id: str | None,
    monitor_config=None,
) -> tuple[bool, str | None]:
    strategy_snapshot = _resolve_signal_strategy_snapshot(
        db=db,
        strategy_id=strategy_id,
    )
    expected_keys = infer_expected_signal_keys(strategy_snapshot=strategy_snapshot)
    rule_keys = _collect_camera_rule_signal_keys(db=db, camera_id=camera_id)
    required_keys = rule_keys or expected_keys
    if not required_keys:
        return True, None
    camera = db.get(Camera, camera_id)
    if camera is None:
        return False, "Local gate blocked (strict): camera not found"
    analysis_roi = extract_analysis_roi(monitor_config)

    try:
        result = detect_with_local_detector(
            camera=camera,
            expected_signal_keys=required_keys,
            person_threshold=settings.local_detector_person_threshold,
            analysis_roi=analysis_roi,
        )
    except LocalDetectorError as exc:
        if settings.local_detector_strict_block:
            return False, f"Local gate blocked (strict): detector unavailable ({exc})"
        return True, None

    if not result.passed:
        return False, "Local gate blocked (strict): " + result.reason
    return True, None


def _resolve_signal_strategy_snapshot(
    *,
    db: Session,
    strategy_id: str | None,
) -> dict:
    selected_strategy: AnalysisStrategy | None = None
    if strategy_id:
        selected_strategy = get_strategy_or_404(db, strategy_id)
    if selected_strategy is None:
        selected_strategy = db.scalar(
            select(AnalysisStrategy)
            .where(AnalysisStrategy.status == "active")
            .where(AnalysisStrategy.is_signal_strategy.is_(True))
            .order_by(AnalysisStrategy.created_at.desc(), AnalysisStrategy.id.asc())
        )
    if selected_strategy is None:
        selected_strategy = db.get(AnalysisStrategy, "preset-fire")
    if selected_strategy is None:
        selected_strategy = db.scalar(
            select(AnalysisStrategy)
            .where(AnalysisStrategy.status == "active")
            .order_by(AnalysisStrategy.created_at.desc(), AnalysisStrategy.id.asc())
        )
    if selected_strategy is None:
        return {}
    return build_strategy_snapshot(selected_strategy)


def _collect_camera_rule_signal_keys(*, db: Session, camera_id: str) -> set[str]:
    rules = list(
        db.scalars(
            select(CameraTriggerRule)
            .where(CameraTriggerRule.camera_id == camera_id)
            .where(CameraTriggerRule.enabled.is_(True))
            .order_by(CameraTriggerRule.priority.asc(), CameraTriggerRule.created_at.asc())
        )
    )
    signal_keys: set[str] = set()
    for rule in rules:
        signal_keys.update(_extract_rule_signal_keys(rule))
    return signal_keys


def _extract_rule_signal_keys(rule: CameraTriggerRule) -> set[str]:
    mode = str(rule.match_mode or "simple").strip().lower()
    if mode == "expression":
        return _extract_expression_signal_keys(rule.expression_json)

    key = str(rule.event_key or rule.event_type or "").strip().lower()
    if not key or key == "custom":
        return set()
    return {key}


def _extract_expression_signal_keys(expression_json: dict | None) -> set[str]:
    keys: set[str] = set()
    if not isinstance(expression_json, dict):
        return keys

    def walk(node: object) -> None:
        if isinstance(node, dict):
            signal_key = node.get("signal")
            if isinstance(signal_key, str) and signal_key.strip():
                keys.add(signal_key.strip().lower())
            child = node.get("condition")
            if child is not None:
                walk(child)
            conditions = node.get("conditions")
            if isinstance(conditions, list):
                for item in conditions:
                    walk(item)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(expression_json)
    return keys
