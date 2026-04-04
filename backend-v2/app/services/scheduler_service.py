import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.camera import Camera, CameraTriggerRule
from app.models.camera_signal import CameraSignalState
from app.models.job import JobSchedule
from app.models.model_call_log import ModelCallLog
from app.models.strategy import AnalysisStrategy
from app.services.alert_service import run_due_alert_webhook_deliveries_once as run_due_alert_webhook_deliveries_once_with_db
from app.services.camera_capture_service import CameraCaptureError, capture_camera_frame
from app.services.camera_roi_service import (
    CameraRoiError,
    apply_analysis_roi_to_frame,
    extract_analysis_roi,
)
from app.services.camera_signal_monitor_service import (
    advance_monitor_schedule,
    get_camera_signal_monitor_config_or_create,
    list_due_monitor_configs,
    mark_monitor_error,
)
from app.services.camera_service import check_camera_status
from app.services.ids import generate_id
from app.services.job_schedule_service import calculate_next_run_at
from app.services.job_service import create_camera_schedule_job
from app.services.local_detector_service import LocalDetectorError, detect_with_local_detector
from app.services.model_call_log_service import build_model_call_details, create_model_call_log
from app.services.providers.base import ProviderRequest
from app.services.providers.factory import get_provider_adapter
from app.services.scheduler_signal_monitor_sweep_service import process_due_monitor_config
from app.services.signal_extractor import extract_signals
from app.services.storage import FileStorageService
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404
from app.services.task_dispatcher import dispatch_signal_monitor_cycle

logger = logging.getLogger(__name__)
settings = get_settings()
PRECHECK_SIGNAL_THRESHOLD = 0.5
PRECHECK_LOCAL_STATE_TTL_SECONDS = 120
PRECHECK_SOFT_NEGATIVE_THRESHOLD = 0.2
PRECHECK_LOCAL_REFRESH_INTERVAL_SECONDS = 300
PRECHECK_LOCAL_FRAME_SAMPLES = 3
PRECHECK_LOCAL_SAMPLE_INTERVAL_MS = 200
SIGNAL_MONITOR_PERSON_THRESHOLD = 0.6
SIGNAL_MONITOR_DEFAULT_THRESHOLD = 0.5
SIGNAL_MONITOR_STATE_TTL_SECONDS = 120


def run_due_job_schedules_once(
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    with SessionLocal() as db:
        return run_due_job_schedules_once_with_db(db, now=now, dispatch_jobs=dispatch_jobs)


def run_due_job_schedules_once_with_db(
    db: Session,
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    current_time = _ensure_aware(now or datetime.now(timezone.utc))
    stmt = (
        select(JobSchedule)
        .where(JobSchedule.status == "active")
        .where(JobSchedule.next_run_at.is_not(None))
        .where(JobSchedule.next_run_at <= current_time)
        .order_by(JobSchedule.next_run_at.asc(), JobSchedule.id.asc())
    )
    schedules = list(db.scalars(stmt))
    created_job_ids: list[str] = []

    for schedule in schedules:
        try:
            precheck_passed, precheck_message = _run_schedule_precheck_if_needed(
                db=db,
                schedule=schedule,
                now=current_time,
            )
            if not precheck_passed:
                persisted_schedule = db.get(JobSchedule, schedule.id)
                if persisted_schedule is None:
                    continue
                persisted_schedule.last_run_at = current_time
                persisted_schedule.next_run_at = calculate_next_run_at(
                    persisted_schedule.schedule_type,
                    persisted_schedule.schedule_value,
                    current_time,
                )
                persisted_schedule.last_error = precheck_message or "Precheck not matched"
                db.commit()
                continue

            job = create_camera_schedule_job(
                db,
                schedule=schedule,
                requested_by="scheduler",
                dispatch=dispatch_jobs,
            )
            created_job_ids.append(job.id)
            if job.status == "failed" and job.error_message:
                persisted_schedule = db.get(JobSchedule, schedule.id)
                if persisted_schedule is not None:
                    persisted_schedule.last_error = job.error_message
                    db.commit()
        except Exception as exc:
            persisted_schedule = db.get(JobSchedule, schedule.id)
            if persisted_schedule is None:
                continue
            persisted_schedule.last_run_at = current_time
            persisted_schedule.next_run_at = calculate_next_run_at(
                persisted_schedule.schedule_type,
                persisted_schedule.schedule_value,
                current_time,
            )
            persisted_schedule.last_error = str(exc)
            db.commit()

    return created_job_ids


def run_camera_status_sweep_once(
    *,
    camera_ids: list[str] | None = None,
) -> dict[str, int]:
    with SessionLocal() as db:
        return run_camera_status_sweep_once_with_db(db, camera_ids=camera_ids)


def run_camera_status_sweep_once_with_db(
    db: Session,
    *,
    camera_ids: list[str] | None = None,
) -> dict[str, int]:
    stmt = select(Camera).order_by(Camera.created_at.desc(), Camera.name.asc())
    if camera_ids:
        stmt = stmt.where(Camera.id.in_(camera_ids))
    cameras = list(db.scalars(stmt))

    checked_count = 0
    failed_count = 0
    for camera in cameras:
        try:
            check_camera_status(db, camera)
            checked_count += 1
        except Exception as exc:
            db.rollback()
            failed_count += 1
            logger.warning("camera status sweep failed for camera_id=%s: %s", camera.id, exc)

    return {
        "checked_count": checked_count,
        "failed_count": failed_count,
        "total_count": len(cameras),
    }


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
    current_time = _ensure_aware(now or datetime.now(timezone.utc))
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


def run_due_alert_webhook_deliveries_once(*, now: datetime | None = None) -> list[str]:
    with SessionLocal() as db:
        return run_due_alert_webhook_deliveries_once_with_db(db, now=now)


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


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
    expected_keys = _infer_expected_signal_keys(strategy_snapshot=strategy_snapshot)
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
        logger.warning("local detector unavailable for signal monitor camera_id=%s: %s", camera_id, exc)
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


def _run_schedule_precheck_if_needed(
    *,
    db: Session,
    schedule: JobSchedule,
    now: datetime | None = None,
) -> tuple[bool, str | None]:
    precheck_strategy_id = (schedule.precheck_strategy_id or "").strip()
    if not precheck_strategy_id:
        return True, None

    camera = db.get(Camera, schedule.camera_id)
    if camera is None:
        raise ValueError("Camera not found")
    monitor_config = get_camera_signal_monitor_config_or_create(db, camera_id=schedule.camera_id)
    analysis_roi = extract_analysis_roi(monitor_config)

    strategy = get_strategy_or_404(db, precheck_strategy_id)
    if strategy.status != "active":
        return False, f"Precheck strategy is not active: {strategy.id}"

    precheck_config = _resolve_precheck_config(schedule.precheck_config)
    expected_signal_keys = _infer_expected_signal_keys(strategy_snapshot=build_strategy_snapshot(strategy))

    local_gate = _run_schedule_local_gate_with_sampling(
        camera=camera,
        analysis_roi=analysis_roi,
        expected_signal_keys=expected_signal_keys,
        person_threshold=float(precheck_config["person_threshold"]),
        frame_samples=int(precheck_config["frame_samples"]),
        sample_interval_ms=int(precheck_config["sample_interval_ms"]),
    )
    if local_gate["error"] is not None:
        if settings.local_detector_strict_block:
            return False, f"Precheck blocked by local detector: {local_gate['error']}"
        logger.warning("local detector unavailable for schedule_id=%s: %s", schedule.id, local_gate["error"])
    else:
        local_result = local_gate["result"]
        if local_result is not None and not local_result.passed:
            best_person = float(local_gate["best_person_confidence"])
            threshold = float(precheck_config["person_threshold"])
            attempts = int(local_gate["attempts"])
            return False, (
                "Precheck blocked by local detector: "
                f"person<{threshold:.2f} (best={best_person:.3f}, sampled_frames={attempts})"
            )

    frame = local_gate.get("frame")
    if frame is None:
        return False, "Precheck capture failed: no valid frame after sampling"

    storage = FileStorageService(root=camera.storage_path or None)
    frame_path = storage.save_bytes(
        frame.content,
        frame.original_name,
        folder=f"precheck/{schedule.id}/{generate_id()}",
    )

    adapter = get_provider_adapter(strategy.model_provider)
    response = adapter.analyze(
        ProviderRequest(
            model=strategy.model_name,
            prompt=strategy.prompt_template,
            image_paths=[frame_path],
            response_format=str(strategy.result_format or "json_schema"),
            response_schema=strategy.response_schema,
        )
    )
    create_model_call_log(
        db,
        provider=strategy.model_provider,
        model_name=strategy.model_name,
        trigger_type="schedule_precheck",
        trigger_source="job_schedule",
        response_format=str(strategy.result_format or "json_schema"),
        success=response.success,
        error_message=response.error_message,
        usage=response.usage,
        input_image_count=1,
        schedule_id=schedule.id,
        camera_id=schedule.camera_id,
        strategy_id=strategy.id,
        details=build_model_call_details(
            prompt=str(strategy.prompt_template or ""),
            response_format=str(strategy.result_format or "json_schema"),
            image_paths=[frame_path],
            input_summary={
                "phase": "precheck",
                "schedule_id": schedule.id,
            },
            raw_response=response.raw_response,
            normalized_json=response.normalized_json,
            error_message=response.error_message,
            context={
                "schedule_id": schedule.id,
                "camera_id": schedule.camera_id,
                "strategy_id": strategy.id,
            },
        ),
    )
    if not response.success:
        message = (response.error_message or response.raw_response or "precheck analyze failed").strip()
        return False, f"Precheck analyze failed: {message}"

    normalized_json = response.normalized_json if isinstance(response.normalized_json, dict) else {}
    strategy_snapshot = build_strategy_snapshot(strategy)
    matched = _resolve_precheck_match(normalized_json=normalized_json, strategy_snapshot=strategy_snapshot)
    if matched:
        return True, None
    return False, f"Precheck not matched (strategy={strategy.id})"


def _run_schedule_local_gate_with_sampling(
    *,
    camera: Camera,
    analysis_roi: dict | None,
    expected_signal_keys: set[str],
    person_threshold: float,
    frame_samples: int,
    sample_interval_ms: int,
) -> dict:
    attempts = max(1, min(int(frame_samples or 1), 5))
    interval_ms = max(0, min(int(sample_interval_ms or 0), 2000))

    best_frame = None
    best_result = None
    best_person_confidence = -1.0

    for index in range(attempts):
        try:
            frame = capture_camera_frame(camera)
        except CameraCaptureError as exc:
            return {
                "frame": None,
                "result": None,
                "best_person_confidence": 0.0,
                "attempts": index + 1,
                "error": f"capture failed: {exc}",
            }
        try:
            frame, _ = apply_analysis_roi_to_frame(frame, analysis_roi)
        except CameraRoiError as exc:
            return {
                "frame": None,
                "result": None,
                "best_person_confidence": 0.0,
                "attempts": index + 1,
                "error": f"ROI crop failed: {exc}",
            }

        try:
            local_result = detect_with_local_detector(
                camera=camera,
                expected_signal_keys=expected_signal_keys,
                person_threshold=person_threshold,
                frame=frame,
                analysis_roi=None,
            )
        except LocalDetectorError as exc:
            return {
                "frame": None,
                "result": None,
                "best_person_confidence": 0.0,
                "attempts": index + 1,
                "error": str(exc),
            }

        person_confidence = float((local_result.signals or {}).get("person") or 0.0)
        if person_confidence >= best_person_confidence:
            best_person_confidence = person_confidence
            best_frame = frame
            best_result = local_result

        if local_result.passed:
            return {
                "frame": frame,
                "result": local_result,
                "best_person_confidence": person_confidence,
                "attempts": index + 1,
                "error": None,
            }

        if index < attempts - 1 and interval_ms > 0:
            time.sleep(interval_ms / 1000.0)

    return {
        "frame": best_frame,
        "result": best_result,
        "best_person_confidence": max(best_person_confidence, 0.0),
        "attempts": attempts,
        "error": None,
    }


def _infer_expected_signal_keys(*, strategy_snapshot: dict) -> set[str]:
    mapping = strategy_snapshot.get("signal_mapping")
    if isinstance(mapping, dict) and mapping:
        return {str(key).strip().lower() for key in mapping.keys() if str(key).strip()}
    return {"person", "fire", "leak"}


def _evaluate_local_signal_gate(
    *,
    db: Session,
    camera_id: str,
    expected_signal_keys: set[str],
    now: datetime,
    person_threshold: float,
    soft_negative_threshold: float,
    state_ttl_seconds: int,
    schedule_id: str | None = None,
    refresh_interval_seconds: int = PRECHECK_LOCAL_REFRESH_INTERVAL_SECONDS,
) -> str | None:
    if not expected_signal_keys:
        return None

    state_map = _load_recent_signal_state_map(
        db=db,
        camera_id=camera_id,
        now=now,
        state_ttl_seconds=state_ttl_seconds,
    )
    if "person" in expected_signal_keys:
        person_confidence = state_map.get("person")
        if person_confidence is None or person_confidence < person_threshold:
            blocked_reason = (
                f"Precheck skipped by local hard gate: person<{person_threshold:.2f} "
                "(expected person signal)"
            )
            return _resolve_local_gate_block_message(
                db=db,
                now=now,
                schedule_id=schedule_id,
                blocked_reason=blocked_reason,
                refresh_interval_seconds=refresh_interval_seconds,
            )

    # fire/leak soft gate:
    # - 若本地是明确负样本（置信度很低）则跳过模型调用
    # - 若本地状态缺失或不明确，保留大模型兜底调用
    if "person" not in expected_signal_keys:
        soft_keys = [key for key in ("fire", "leak") if key in expected_signal_keys]
        if soft_keys:
            soft_values = [state_map.get(key) for key in soft_keys]
            if soft_values and all(value is not None and value < soft_negative_threshold for value in soft_values):
                blocked_reason = (
                    "Precheck skipped by local soft gate: fire/leak clear-negative "
                    f"(threshold<{soft_negative_threshold:.2f})"
                )
                return _resolve_local_gate_block_message(
                    db=db,
                    now=now,
                    schedule_id=schedule_id,
                    blocked_reason=blocked_reason,
                    refresh_interval_seconds=refresh_interval_seconds,
                )

    return None


def _load_recent_signal_state_map(
    *,
    db: Session,
    camera_id: str,
    now: datetime,
    state_ttl_seconds: int,
) -> dict[str, float]:
    states = list(
        db.scalars(
            select(CameraSignalState).where(CameraSignalState.camera_id == camera_id)
        )
    )
    ttl_seconds = max(int(state_ttl_seconds), 1)
    result: dict[str, float] = {}
    for state in states:
        signal_key = str(state.signal_key or "").strip().lower()
        if not signal_key:
            continue
        if state.last_seen_at is None:
            continue
        last_seen_at = _ensure_aware(state.last_seen_at)
        if (now - last_seen_at).total_seconds() > ttl_seconds:
            continue
        result[signal_key] = float(state.last_confidence or 0.0)
    return result


def _resolve_precheck_config(raw_config: dict | None) -> dict[str, float | int]:
    config = raw_config if isinstance(raw_config, dict) else {}
    person_threshold = float(config.get("person_threshold", PRECHECK_SIGNAL_THRESHOLD))
    soft_negative_threshold = float(config.get("soft_negative_threshold", PRECHECK_SOFT_NEGATIVE_THRESHOLD))
    state_ttl_seconds = int(config.get("state_ttl_seconds", PRECHECK_LOCAL_STATE_TTL_SECONDS))
    refresh_interval_seconds = int(config.get("refresh_interval_seconds", PRECHECK_LOCAL_REFRESH_INTERVAL_SECONDS))
    frame_samples = int(config.get("frame_samples", PRECHECK_LOCAL_FRAME_SAMPLES))
    sample_interval_ms = int(config.get("sample_interval_ms", PRECHECK_LOCAL_SAMPLE_INTERVAL_MS))

    if person_threshold < 0 or person_threshold > 1:
        person_threshold = PRECHECK_SIGNAL_THRESHOLD
    if soft_negative_threshold < 0 or soft_negative_threshold > 1:
        soft_negative_threshold = PRECHECK_SOFT_NEGATIVE_THRESHOLD
    if state_ttl_seconds < 1:
        state_ttl_seconds = PRECHECK_LOCAL_STATE_TTL_SECONDS
    if refresh_interval_seconds < 0:
        refresh_interval_seconds = PRECHECK_LOCAL_REFRESH_INTERVAL_SECONDS
    if frame_samples < 1:
        frame_samples = PRECHECK_LOCAL_FRAME_SAMPLES
    if frame_samples > 5:
        frame_samples = 5
    if sample_interval_ms < 0:
        sample_interval_ms = 0
    if sample_interval_ms > 2000:
        sample_interval_ms = 2000

    return {
        "person_threshold": person_threshold,
        "soft_negative_threshold": soft_negative_threshold,
        "state_ttl_seconds": state_ttl_seconds,
        "refresh_interval_seconds": refresh_interval_seconds,
        "frame_samples": frame_samples,
        "sample_interval_ms": sample_interval_ms,
    }


def _resolve_local_gate_block_message(
    *,
    db: Session,
    now: datetime,
    schedule_id: str | None,
    blocked_reason: str,
    refresh_interval_seconds: int,
) -> str | None:
    if schedule_id and refresh_interval_seconds > 0:
        last_call_at = _get_last_precheck_model_call_at(db=db, schedule_id=schedule_id)
        if last_call_at is None:
            return None
        elapsed = (now - last_call_at).total_seconds()
        if elapsed >= refresh_interval_seconds:
            return None
        remaining = max(int(refresh_interval_seconds - elapsed), 0)
        return f"{blocked_reason} | refresh in {remaining}s"
    return blocked_reason


def _get_last_precheck_model_call_at(
    *,
    db: Session,
    schedule_id: str,
) -> datetime | None:
    latest_log = db.scalar(
        select(ModelCallLog)
        .where(ModelCallLog.trigger_type == "schedule_precheck")
        .where(ModelCallLog.schedule_id == schedule_id)
        .order_by(ModelCallLog.created_at.desc(), ModelCallLog.id.desc())
        .limit(1)
    )
    if latest_log is None or latest_log.created_at is None:
        return None
    return _ensure_aware(latest_log.created_at)


def _resolve_precheck_match(*, normalized_json: dict, strategy_snapshot: dict) -> bool:
    direct = _resolve_direct_precheck_flag(normalized_json)
    if direct is not None:
        return direct

    signals = extract_signals(normalized_json=normalized_json, strategy_snapshot=strategy_snapshot)
    for signal_key, confidence in signals.items():
        if signal_key == "person_fire":
            continue
        if float(confidence or 0) >= PRECHECK_SIGNAL_THRESHOLD:
            return True
    return False


def _resolve_direct_precheck_flag(payload: dict) -> bool | None:
    candidates = (
        "should_trigger",
        "should_execute",
        "matched",
        "is_matched",
        "triggered",
        "hit",
        "pass",
    )
    for key in candidates:
        if key not in payload:
            continue
        value = payload[key]
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return float(value) > 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "yes", "1", "matched", "hit", "pass"}:
                return True
            if normalized in {"false", "no", "0", "unmatched", "miss"}:
                return False
    return None
