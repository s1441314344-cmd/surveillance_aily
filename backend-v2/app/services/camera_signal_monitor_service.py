from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.camera_signal import CameraSignalMonitorConfig
from app.models.strategy import AnalysisStrategy
from app.schemas.camera import (
    CameraSignalMonitorConfigRead,
    CameraSignalMonitorConfigUpdate,
    CameraSignalMonitorStartRequest,
    CameraSignalMonitorStatusRead,
)
from app.services.ids import generate_id
from app.services.job_schedule_service import calculate_next_run_at


def serialize_camera_signal_monitor_config(config: CameraSignalMonitorConfig) -> CameraSignalMonitorConfigRead:
    return CameraSignalMonitorConfigRead(
        id=config.id,
        camera_id=config.camera_id,
        enabled=config.enabled,
        runtime_mode=config.runtime_mode,
        signal_strategy_id=config.signal_strategy_id,
        monitor_interval_seconds=config.monitor_interval_seconds,
        schedule_type=config.schedule_type,
        schedule_value=config.schedule_value,
        manual_until=_serialize_datetime(config.manual_until),
        next_run_at=_serialize_datetime(config.next_run_at),
        last_run_at=_serialize_datetime(config.last_run_at),
        last_error=config.last_error,
        created_at=_serialize_datetime(config.created_at),
        updated_at=_serialize_datetime(config.updated_at),
    )


def get_camera_signal_monitor_config_or_create(
    db: Session,
    *,
    camera_id: str,
) -> CameraSignalMonitorConfig:
    stmt = select(CameraSignalMonitorConfig).where(CameraSignalMonitorConfig.camera_id == camera_id)
    config = db.scalar(stmt)
    if config is not None:
        return config

    config = CameraSignalMonitorConfig(
        id=generate_id(),
        camera_id=camera_id,
        enabled=False,
        runtime_mode="daemon",
        signal_strategy_id=_resolve_default_signal_strategy_id(db),
        monitor_interval_seconds=30,
        schedule_type=None,
        schedule_value=None,
        manual_until=None,
        next_run_at=None,
        last_run_at=None,
        last_error=None,
    )
    db.add(config)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent requests may both try to create the same camera config.
        db.rollback()
        existing = db.scalar(stmt)
        if existing is not None:
            return existing
        raise
    db.refresh(config)
    return config


def get_camera_signal_monitor_config_read(
    db: Session,
    *,
    camera_id: str,
) -> CameraSignalMonitorConfigRead:
    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    return serialize_camera_signal_monitor_config(config)


def update_camera_signal_monitor_config(
    db: Session,
    *,
    camera_id: str,
    payload: CameraSignalMonitorConfigUpdate,
) -> CameraSignalMonitorConfigRead:
    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    updates = payload.model_dump(exclude_unset=True)

    for field_name, value in updates.items():
        if field_name == "runtime_mode" and value is not None:
            value = str(value).strip().lower()
            if value not in {"daemon", "manual", "schedule"}:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unsupported runtime_mode: {value}",
                )
        if field_name == "manual_until":
            value = _parse_datetime(value)
        setattr(config, field_name, value)

    if config.enabled:
        _recalculate_next_run_at(config, now=_utcnow())
    db.commit()
    db.refresh(config)
    return serialize_camera_signal_monitor_config(config)


def start_camera_signal_monitor(
    db: Session,
    *,
    camera_id: str,
    payload: CameraSignalMonitorStartRequest | None = None,
) -> CameraSignalMonitorStatusRead:
    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    now = _utcnow()
    config.enabled = True
    config.next_run_at = now
    config.last_error = None
    duration_seconds = payload.duration_seconds if payload is not None else 600
    if config.runtime_mode == "manual":
        config.manual_until = now + timedelta(seconds=max(int(duration_seconds), 30))
    db.commit()
    db.refresh(config)
    return serialize_camera_signal_monitor_status(config)


def stop_camera_signal_monitor(
    db: Session,
    *,
    camera_id: str,
) -> CameraSignalMonitorStatusRead:
    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    config.enabled = False
    config.manual_until = None
    config.next_run_at = None
    db.commit()
    db.refresh(config)
    return serialize_camera_signal_monitor_status(config)


def get_camera_signal_monitor_status(
    db: Session,
    *,
    camera_id: str,
) -> CameraSignalMonitorStatusRead:
    config = get_camera_signal_monitor_config_or_create(db, camera_id=camera_id)
    return serialize_camera_signal_monitor_status(config)


def list_due_signal_monitor_configs(
    db: Session,
    *,
    now: datetime | None = None,
) -> list[CameraSignalMonitorConfig]:
    current_time = _ensure_aware(now or _utcnow())
    stmt = (
        select(CameraSignalMonitorConfig)
        .where(CameraSignalMonitorConfig.enabled.is_(True))
        .where(CameraSignalMonitorConfig.next_run_at.is_not(None))
        .where(CameraSignalMonitorConfig.next_run_at <= current_time)
        .order_by(CameraSignalMonitorConfig.next_run_at.asc(), CameraSignalMonitorConfig.id.asc())
    )
    return list(db.scalars(stmt))


def mark_signal_monitor_cycle_dispatched(
    db: Session,
    *,
    config: CameraSignalMonitorConfig,
    now: datetime | None = None,
    error_message: str | None = None,
) -> None:
    current_time = _ensure_aware(now or _utcnow())
    config.last_run_at = current_time
    _recalculate_next_run_at(config, now=current_time)
    config.last_error = error_message
    if config.runtime_mode == "manual" and config.manual_until is not None and config.manual_until <= current_time:
        config.enabled = False
        config.next_run_at = None


def list_due_monitor_configs(
    db: Session,
    *,
    now: datetime | None = None,
) -> list[CameraSignalMonitorConfig]:
    return list_due_signal_monitor_configs(db, now=now)


def advance_monitor_schedule(
    config: CameraSignalMonitorConfig,
    *,
    now: datetime | None = None,
) -> None:
    current_time = _ensure_aware(now or _utcnow())
    config.last_run_at = current_time
    _recalculate_next_run_at(config, now=current_time)
    config.last_error = None
    if config.runtime_mode == "manual" and config.manual_until is not None and config.manual_until <= current_time:
        config.enabled = False
        config.next_run_at = None


def mark_monitor_error(
    config: CameraSignalMonitorConfig,
    *,
    error_message: str,
    now: datetime | None = None,
) -> None:
    current_time = _ensure_aware(now or _utcnow())
    config.last_run_at = current_time
    config.last_error = error_message
    _recalculate_next_run_at(config, now=current_time)


def serialize_camera_signal_monitor_status(config: CameraSignalMonitorConfig) -> CameraSignalMonitorStatusRead:
    return CameraSignalMonitorStatusRead(
        camera_id=config.camera_id,
        enabled=config.enabled,
        runtime_mode=config.runtime_mode,
        signal_strategy_id=config.signal_strategy_id,
        next_run_at=_serialize_datetime(config.next_run_at),
        last_run_at=_serialize_datetime(config.last_run_at),
        last_error=config.last_error,
    )


def _resolve_default_signal_strategy_id(db: Session) -> str | None:
    strategy = db.scalar(
        select(AnalysisStrategy)
        .where(AnalysisStrategy.status == "active")
        .where(AnalysisStrategy.is_signal_strategy.is_(True))
        .order_by(AnalysisStrategy.created_at.desc(), AnalysisStrategy.id.asc())
    )
    if strategy is not None:
        return strategy.id
    fallback = db.get(AnalysisStrategy, "preset-fire")
    if fallback is not None:
        return fallback.id
    return db.scalar(select(AnalysisStrategy.id).where(AnalysisStrategy.status == "active"))


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid manual_until datetime: {value}",
        ) from exc
    return _ensure_aware(parsed)


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


def _recalculate_next_run_at(config: CameraSignalMonitorConfig, *, now: datetime) -> None:
    if not config.enabled:
        config.next_run_at = None
        return
    mode = (config.runtime_mode or "daemon").strip().lower()
    if mode == "manual":
        if config.manual_until is None or _ensure_aware(config.manual_until) <= now:
            config.enabled = False
            config.next_run_at = None
            return
        config.next_run_at = now + timedelta(seconds=max(int(config.monitor_interval_seconds or 30), 1))
        return
    if mode == "schedule":
        schedule_type = str(config.schedule_type or "interval_minutes")
        schedule_value = str(config.schedule_value or "5")
        config.next_run_at = calculate_next_run_at(schedule_type, schedule_value, now)
        return
    config.next_run_at = now + timedelta(seconds=max(int(config.monitor_interval_seconds or 30), 1))


# Backward-compatible aliases used by camera routes/service integration.
def serialize_monitor_config(config: CameraSignalMonitorConfig) -> CameraSignalMonitorConfigRead:
    return serialize_camera_signal_monitor_config(config)


def serialize_monitor_status(config: CameraSignalMonitorConfig) -> CameraSignalMonitorStatusRead:
    return serialize_camera_signal_monitor_status(config)


def get_monitor_config_or_create(db: Session, *, camera):
    return get_camera_signal_monitor_config_or_create(db, camera_id=camera.id)


def upsert_monitor_config(db: Session, *, camera, payload: CameraSignalMonitorConfigUpdate) -> CameraSignalMonitorConfigRead:
    return update_camera_signal_monitor_config(db, camera_id=camera.id, payload=payload)


def start_manual_monitor(db: Session, *, camera, duration_seconds: int) -> CameraSignalMonitorStatusRead:
    return start_camera_signal_monitor(
        db,
        camera_id=camera.id,
        payload=CameraSignalMonitorStartRequest(duration_seconds=duration_seconds),
    )


def stop_monitor(db: Session, *, camera) -> CameraSignalMonitorStatusRead:
    return stop_camera_signal_monitor(db, camera_id=camera.id)


def get_monitor_config_or_create(db: Session, *, camera) -> CameraSignalMonitorConfig:
    return get_camera_signal_monitor_config_or_create(db, camera_id=camera.id)


def serialize_monitor_config(config: CameraSignalMonitorConfig) -> CameraSignalMonitorConfigRead:
    return serialize_camera_signal_monitor_config(config)


def serialize_monitor_status(config: CameraSignalMonitorConfig) -> CameraSignalMonitorStatusRead:
    return serialize_camera_signal_monitor_status(config)


def upsert_monitor_config(
    db: Session,
    *,
    camera,
    payload: CameraSignalMonitorConfigUpdate,
) -> CameraSignalMonitorConfigRead:
    return update_camera_signal_monitor_config(db, camera_id=camera.id, payload=payload)


def start_manual_monitor(
    db: Session,
    *,
    camera,
    duration_seconds: int,
) -> CameraSignalMonitorStatusRead:
    return start_camera_signal_monitor(
        db,
        camera_id=camera.id,
        payload=CameraSignalMonitorStartRequest(duration_seconds=duration_seconds),
    )


def stop_monitor(
    db: Session,
    *,
    camera,
) -> CameraSignalMonitorStatusRead:
    return stop_camera_signal_monitor(db, camera_id=camera.id)
