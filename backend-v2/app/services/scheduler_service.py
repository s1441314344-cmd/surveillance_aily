import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.camera import Camera
from app.models.job import JobSchedule
from app.services.alert_service import run_due_alert_webhook_deliveries_once as run_due_alert_webhook_deliveries_once_with_db
from app.services.camera_capture_service import CameraCaptureError, capture_camera_frame
from app.services.camera_signal_monitor_service import (
    advance_monitor_schedule,
    list_due_monitor_configs,
    mark_monitor_error,
)
from app.services.camera_signal_pipeline_service import process_camera_signal_cycle
from app.services.camera_service import check_camera_status
from app.services.ids import generate_id
from app.services.job_schedule_service import calculate_next_run_at
from app.services.job_service import create_camera_schedule_job
from app.services.providers.base import ProviderRequest
from app.services.providers.factory import get_provider_adapter
from app.services.signal_extractor import extract_signals
from app.services.storage import FileStorageService
from app.services.strategy_service import build_strategy_snapshot, get_strategy_or_404

logger = logging.getLogger(__name__)
settings = get_settings()


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
    from app.workers.tasks import process_camera_cycle as enqueue_signal_cycle

    current_time = _ensure_aware(now or datetime.now(timezone.utc))
    due_configs = list_due_monitor_configs(db, now=current_time)
    processed_camera_ids: list[str] = []
    should_dispatch = settings.celery_enabled if dispatch_jobs is None else dispatch_jobs

    for config in due_configs:
        try:
            advance_monitor_schedule(config, now=current_time)
            db.commit()
            if should_dispatch:
                enqueue_signal_cycle.delay(config.camera_id, "signal_monitor")
            else:
                process_camera_signal_cycle(db, camera_id=config.camera_id, trigger_source="signal_monitor_inline")
            processed_camera_ids.append(config.camera_id)
        except Exception as exc:  # pragma: no cover - safety fallback
            db.rollback()
            persisted_config = db.get(type(config), config.id)
            if persisted_config is None:
                continue
            mark_monitor_error(persisted_config, error_message=str(exc), now=current_time)
            db.commit()
            logger.warning("signal monitor cycle failed for camera_id=%s: %s", config.camera_id, exc)

    return processed_camera_ids


def run_due_alert_webhook_deliveries_once(*, now: datetime | None = None) -> list[str]:
    with SessionLocal() as db:
        return run_due_alert_webhook_deliveries_once_with_db(db, now=now)


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _run_schedule_precheck_if_needed(
    *,
    db: Session,
    schedule: JobSchedule,
) -> tuple[bool, str | None]:
    precheck_strategy_id = (schedule.precheck_strategy_id or "").strip()
    if not precheck_strategy_id:
        return True, None

    camera = db.get(Camera, schedule.camera_id)
    if camera is None:
        raise ValueError("Camera not found")

    strategy = get_strategy_or_404(db, precheck_strategy_id)
    if strategy.status != "active":
        return False, f"Precheck strategy is not active: {strategy.id}"

    try:
        frame = capture_camera_frame(camera)
    except CameraCaptureError as exc:
        return False, f"Precheck capture failed: {exc}"

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
    if not response.success:
        message = (response.error_message or response.raw_response or "precheck analyze failed").strip()
        return False, f"Precheck analyze failed: {message}"

    normalized_json = response.normalized_json if isinstance(response.normalized_json, dict) else {}
    strategy_snapshot = build_strategy_snapshot(strategy)
    matched = _resolve_precheck_match(normalized_json=normalized_json, strategy_snapshot=strategy_snapshot)
    if matched:
        return True, None
    return False, f"Precheck not matched (strategy={strategy.id})"


def _resolve_precheck_match(*, normalized_json: dict, strategy_snapshot: dict) -> bool:
    direct = _resolve_direct_precheck_flag(normalized_json)
    if direct is not None:
        return direct

    signals = extract_signals(normalized_json=normalized_json, strategy_snapshot=strategy_snapshot)
    for signal_key, confidence in signals.items():
        if signal_key == "person_fire":
            continue
        if float(confidence or 0) > 0:
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
