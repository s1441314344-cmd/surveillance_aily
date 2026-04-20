import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.camera import Camera
from app.models.job import Job, JobSchedule
from app.models.model_call_log import ModelCallLog
from app.services.camera_capture_service import CameraCaptureError, capture_camera_frame
from app.services.camera_roi_service import CameraRoiError, apply_analysis_roi_to_frame, extract_analysis_roi
from app.services.camera_signal_monitor_service import get_camera_signal_monitor_config_or_create
from app.services.ids import generate_id
from app.services.job_service import create_camera_schedule_job
from app.services.job_schedule_service import calculate_next_run_at
from app.services.local_detector_service import LocalDetectorError, detect_with_local_detector
from app.services.model_call_log_service import build_model_call_details, create_model_call_log
from app.services.providers.base import ProviderRequest
from app.services.providers.factory import get_provider_adapter
from app.services.scheduler_common import ensure_aware, infer_expected_signal_keys, settings
from app.services.signal_extractor import extract_signals
from app.services.storage import FileStorageService
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404


logger = logging.getLogger(__name__)
PRECHECK_SIGNAL_THRESHOLD = 0.5
PRECHECK_LOCAL_STATE_TTL_SECONDS = 120
PRECHECK_SOFT_NEGATIVE_THRESHOLD = 0.2
PRECHECK_LOCAL_REFRESH_INTERVAL_SECONDS = 300
PRECHECK_LOCAL_FRAME_SAMPLES = 3
PRECHECK_LOCAL_SAMPLE_INTERVAL_MS = 200


@dataclass
class ScheduleDispatchReport:
    mode: str
    due_count: int = 0
    claimed_count: int = 0
    created_job_ids: list[str] = field(default_factory=list)
    skipped_inflight_count: int = 0
    stale_failed_count: int = 0
    precheck_skipped_count: int = 0
    error_count: int = 0

    def to_dict(self) -> dict[str, object]:
        return {
            "mode": self.mode,
            "due_count": self.due_count,
            "claimed_count": self.claimed_count,
            "created_count": len(self.created_job_ids),
            "created_job_ids": list(self.created_job_ids),
            "skipped_inflight_count": self.skipped_inflight_count,
            "stale_failed_count": self.stale_failed_count,
            "precheck_skipped_count": self.precheck_skipped_count,
            "error_count": self.error_count,
        }


def run_due_job_schedules_once(
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    return run_due_job_schedules_once_report(now=now, dispatch_jobs=dispatch_jobs)["created_job_ids"]


def run_due_job_schedules_once_report(
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> dict[str, object]:
    with SessionLocal() as db:
        return run_due_job_schedules_once_with_db_report(db, now=now, dispatch_jobs=dispatch_jobs)


def run_due_job_schedules_once_with_db(
    db: Session,
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> list[str]:
    return run_due_job_schedules_once_with_db_report(db, now=now, dispatch_jobs=dispatch_jobs)["created_job_ids"]


def run_due_job_schedules_once_with_db_report(
    db: Session,
    *,
    now: datetime | None = None,
    dispatch_jobs: bool | None = None,
) -> dict[str, object]:
    current_time = ensure_aware(now or datetime.now(timezone.utc))
    report = ScheduleDispatchReport(mode="locked" if _supports_schedule_row_locking(db=db) else "snapshot")

    if report.mode == "locked":
        while True:
            schedule = _take_next_due_schedule_for_update(db=db, now=current_time)
            if schedule is None:
                break
            report.claimed_count += 1
            events, job_id = _process_single_due_schedule(
                db=db,
                schedule=schedule,
                now=current_time,
                dispatch_jobs=dispatch_jobs,
            )
            _apply_schedule_events(report=report, events=events, job_id=job_id)
        report.due_count = report.claimed_count
        return report.to_dict()

    schedules = _run_due_schedules_snapshot(db=db, now=current_time)
    report.due_count = len(schedules)
    report.claimed_count = len(schedules)
    for schedule in schedules:
        events, job_id = _process_single_due_schedule(
            db=db,
            schedule=schedule,
            now=current_time,
            dispatch_jobs=dispatch_jobs,
        )
        _apply_schedule_events(report=report, events=events, job_id=job_id)
    return report.to_dict()


def _apply_schedule_events(
    *,
    report: ScheduleDispatchReport,
    events: set[str],
    job_id: str | None,
) -> None:
    if "created" in events and job_id:
        report.created_job_ids.append(job_id)
    if "skipped_inflight" in events:
        report.skipped_inflight_count += 1
    if "stale_recovered" in events:
        report.stale_failed_count += 1
    if "precheck_skipped" in events:
        report.precheck_skipped_count += 1
    if "error" in events:
        report.error_count += 1


def _process_single_due_schedule(
    *,
    db: Session,
    schedule: JobSchedule,
    now: datetime,
    dispatch_jobs: bool | None,
) -> tuple[set[str], str | None]:
    events: set[str] = set()
    try:
        inflight_job = _get_inflight_schedule_job(db=db, schedule_id=schedule.id)
        if inflight_job is not None:
            inflight_timeout_seconds = _resolve_inflight_timeout_seconds()
            inflight_age_seconds = _calculate_inflight_job_age_seconds(
                job=inflight_job,
                now=now,
            )
            if (
                inflight_timeout_seconds > 0
                and inflight_age_seconds is not None
                and inflight_age_seconds >= inflight_timeout_seconds
            ):
                _mark_inflight_job_stale_failed(
                    db=db,
                    schedule_id=schedule.id,
                    inflight_job=inflight_job,
                    inflight_age_seconds=inflight_age_seconds,
                    timeout_seconds=inflight_timeout_seconds,
                    now=now,
                )
                events.add("stale_recovered")
            else:
                persisted_schedule = db.get(JobSchedule, schedule.id)
                if persisted_schedule is None:
                    return {"error"}, None
                persisted_schedule.last_run_at = now
                persisted_schedule.next_run_at = calculate_next_run_at(
                    persisted_schedule.schedule_type,
                    persisted_schedule.schedule_value,
                    now,
                )
                persisted_schedule.last_error = f"Skipped duplicate dispatch: in-flight job {inflight_job.id}"
                db.commit()
                return {"skipped_inflight"}, None

        precheck_passed, precheck_message = _run_schedule_precheck_if_needed(
            db=db,
            schedule=schedule,
            now=now,
        )
        if not precheck_passed:
            persisted_schedule = db.get(JobSchedule, schedule.id)
            if persisted_schedule is None:
                return {"error"}, None
            persisted_schedule.last_run_at = now
            persisted_schedule.next_run_at = calculate_next_run_at(
                persisted_schedule.schedule_type,
                persisted_schedule.schedule_value,
                now,
            )
            persisted_schedule.last_error = precheck_message or "Precheck not matched"
            db.commit()
            events.add("precheck_skipped")
            return events, None

        job = create_camera_schedule_job(
            db,
            schedule=schedule,
            requested_by="scheduler",
            dispatch=dispatch_jobs,
        )
        if job.status == "failed" and job.error_message:
            persisted_schedule = db.get(JobSchedule, schedule.id)
            if persisted_schedule is not None:
                persisted_schedule.last_error = job.error_message
                db.commit()
        events.add("created")
        return events, job.id
    except Exception as exc:
        persisted_schedule = db.get(JobSchedule, schedule.id)
        if persisted_schedule is None:
            return events | {"error"}, None
        persisted_schedule.last_run_at = now
        persisted_schedule.next_run_at = calculate_next_run_at(
            persisted_schedule.schedule_type,
            persisted_schedule.schedule_value,
            now,
        )
        persisted_schedule.last_error = str(exc)
        db.commit()
        events.add("error")
        return events, None


def _build_due_schedule_stmt(*, now: datetime):
    return (
        select(JobSchedule)
        .where(JobSchedule.status == "active")
        .where(JobSchedule.next_run_at.is_not(None))
        .where(JobSchedule.next_run_at <= now)
        .order_by(JobSchedule.next_run_at.asc(), JobSchedule.id.asc())
    )


def _supports_schedule_row_locking(*, db: Session) -> bool:
    bind = db.get_bind()
    dialect_name = bind.dialect.name if bind and bind.dialect else ""
    return dialect_name in {"postgresql", "mysql", "mariadb"}


def _take_next_due_schedule_for_update(
    *,
    db: Session,
    now: datetime,
) -> JobSchedule | None:
    stmt = _build_due_schedule_stmt(now=now).limit(1).with_for_update(skip_locked=True)
    return db.scalar(stmt)


def _run_due_schedules_snapshot(
    *,
    db: Session,
    now: datetime,
) -> list[JobSchedule]:
    return list(db.scalars(_build_due_schedule_stmt(now=now)))


def _get_inflight_schedule_job(*, db: Session, schedule_id: str) -> Job | None:
    return db.scalar(
        select(Job)
        .where(Job.schedule_id == schedule_id)
        .where(Job.status.in_(("queued", "running")))
        .order_by(Job.created_at.desc(), Job.id.desc())
        .limit(1)
    )


def _resolve_inflight_timeout_seconds() -> int:
    raw_timeout = getattr(settings, "scheduler_inflight_job_timeout_seconds", 900)
    try:
        timeout = int(raw_timeout)
    except (TypeError, ValueError):
        return 900
    return max(timeout, 0)


def _calculate_inflight_job_age_seconds(*, job: Job, now: datetime) -> float | None:
    reference_time = job.started_at or job.updated_at or job.created_at
    if reference_time is None:
        return None
    reference_time = ensure_aware(reference_time)
    return max((now - reference_time).total_seconds(), 0.0)


def _mark_inflight_job_stale_failed(
    *,
    db: Session,
    schedule_id: str,
    inflight_job: Job,
    inflight_age_seconds: float,
    timeout_seconds: int,
    now: datetime,
) -> None:
    age_seconds_int = int(inflight_age_seconds)
    inflight_job.status = "failed"
    inflight_job.finished_at = now
    inflight_job.error_message = (
        "Marked failed by scheduler: stale in-flight timeout "
        f"(age={age_seconds_int}s, timeout={timeout_seconds}s)"
    )
    persisted_schedule = db.get(JobSchedule, schedule_id)
    if persisted_schedule is not None:
        persisted_schedule.last_error = (
            "Recovered stale in-flight job "
            f"{inflight_job.id} after {age_seconds_int}s (timeout={timeout_seconds}s)"
        )
    db.commit()


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
    expected_signal_keys = infer_expected_signal_keys(strategy_snapshot=build_strategy_snapshot(strategy))

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
    return ensure_aware(latest_log.created_at)


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
