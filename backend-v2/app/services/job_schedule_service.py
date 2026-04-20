from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import JobSchedule
from app.schemas.job import JobScheduleCreate, JobScheduleRead, JobScheduleUpdate
from app.services.camera_service import get_camera_or_404
from app.services.ids import generate_id
from app.services.strategy_service import get_strategy_or_404

SCHEDULE_STATUS_ACTIVE = "active"
SCHEDULE_STATUS_PAUSED = "paused"
VALID_SCHEDULE_STATUSES = {SCHEDULE_STATUS_ACTIVE, SCHEDULE_STATUS_PAUSED}
SCHEDULE_TYPE_INTERVAL_MINUTES = "interval_minutes"
SCHEDULE_TYPE_DAILY_TIME = "daily_time"
VALID_SCHEDULE_TYPES = {SCHEDULE_TYPE_INTERVAL_MINUTES, SCHEDULE_TYPE_DAILY_TIME}


def serialize_job_schedule(schedule: JobSchedule) -> JobScheduleRead:
    return JobScheduleRead(
        id=schedule.id,
        camera_id=schedule.camera_id,
        strategy_id=schedule.strategy_id,
        precheck_strategy_id=schedule.precheck_strategy_id,
        precheck_config=schedule.precheck_config,
        schedule_type=schedule.schedule_type,
        schedule_value=schedule.schedule_value,
        status=schedule.status,
        next_run_at=_serialize_datetime(schedule.next_run_at),
        last_run_at=_serialize_datetime(schedule.last_run_at),
        last_error=schedule.last_error,
        created_at=_serialize_datetime(schedule.created_at),
        updated_at=_serialize_datetime(schedule.updated_at),
    )


def list_job_schedules(
    db: Session,
    *,
    status_filter: str | None = None,
    camera_id: str | None = None,
    strategy_id: str | None = None,
) -> list[JobScheduleRead]:
    stmt = select(JobSchedule).order_by(JobSchedule.created_at.desc(), JobSchedule.id.desc())
    if status_filter:
        _validate_schedule_status(status_filter)
        stmt = stmt.where(JobSchedule.status == status_filter)
    if camera_id:
        stmt = stmt.where(JobSchedule.camera_id == camera_id)
    if strategy_id:
        stmt = stmt.where(JobSchedule.strategy_id == strategy_id)
    return [serialize_job_schedule(item) for item in db.scalars(stmt)]


def get_job_schedule_or_404(db: Session, schedule_id: str) -> JobSchedule:
    schedule = db.get(JobSchedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job schedule not found")
    return schedule


def create_job_schedule(db: Session, payload: JobScheduleCreate) -> JobScheduleRead:
    _validate_schedule_type_and_value(payload.schedule_type, payload.schedule_value)
    get_camera_or_404(db, payload.camera_id)
    strategy = get_strategy_or_404(db, payload.strategy_id)
    _ensure_strategy_active(strategy.status)
    _validate_precheck_strategy(db, payload.precheck_strategy_id)
    normalized_precheck_config = _normalize_precheck_config(payload.precheck_config)
    current_time = _ensure_aware(datetime.now(timezone.utc))

    schedule = JobSchedule(
        id=generate_id(),
        camera_id=payload.camera_id,
        strategy_id=payload.strategy_id,
        precheck_strategy_id=payload.precheck_strategy_id,
        precheck_config=normalized_precheck_config,
        schedule_type=payload.schedule_type,
        schedule_value=payload.schedule_value,
        status=SCHEDULE_STATUS_ACTIVE,
        next_run_at=calculate_next_run_at(payload.schedule_type, payload.schedule_value, current_time),
        last_run_at=None,
        last_error=None,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return serialize_job_schedule(schedule)


def update_job_schedule(db: Session, schedule: JobSchedule, payload: JobScheduleUpdate) -> JobScheduleRead:
    updates = payload.model_dump(exclude_unset=True)
    current_time = _ensure_aware(datetime.now(timezone.utc))
    has_explicit_next_run_at = "next_run_at" in updates
    explicit_next_run_at_raw = updates.pop("next_run_at", None)

    if "camera_id" in updates and updates["camera_id"] is not None:
        get_camera_or_404(db, updates["camera_id"])
    if "strategy_id" in updates and updates["strategy_id"] is not None:
        strategy = get_strategy_or_404(db, updates["strategy_id"])
        _ensure_strategy_active(strategy.status)
    if "precheck_strategy_id" in updates:
        _validate_precheck_strategy(db, updates.get("precheck_strategy_id"))
    if "precheck_config" in updates:
        updates["precheck_config"] = _normalize_precheck_config(updates.get("precheck_config"))

    next_schedule_type = updates.get("schedule_type", schedule.schedule_type)
    next_schedule_value = updates.get("schedule_value", schedule.schedule_value)
    _validate_schedule_type_and_value(next_schedule_type, next_schedule_value)

    if "status" in updates and updates["status"] is not None:
        _validate_schedule_status(updates["status"])

    for field_name, value in updates.items():
        setattr(schedule, field_name, value)

    if schedule.status == SCHEDULE_STATUS_ACTIVE:
        if has_explicit_next_run_at:
            if explicit_next_run_at_raw is None:
                schedule.next_run_at = calculate_next_run_at(schedule.schedule_type, schedule.schedule_value, current_time)
            else:
                schedule.next_run_at = _parse_datetime(explicit_next_run_at_raw, field_name="next_run_at")
        else:
            schedule.next_run_at = calculate_next_run_at(schedule.schedule_type, schedule.schedule_value, current_time)
    else:
        schedule.next_run_at = None

    db.commit()
    db.refresh(schedule)
    return serialize_job_schedule(schedule)


def update_job_schedule_status(db: Session, schedule: JobSchedule, next_status: str) -> JobScheduleRead:
    _validate_schedule_status(next_status)
    schedule.status = next_status
    current_time = _ensure_aware(datetime.now(timezone.utc))
    if next_status == SCHEDULE_STATUS_ACTIVE:
        schedule.next_run_at = calculate_next_run_at(schedule.schedule_type, schedule.schedule_value, current_time)
    else:
        schedule.next_run_at = None
    db.commit()
    db.refresh(schedule)
    return serialize_job_schedule(schedule)


def delete_job_schedule(db: Session, schedule: JobSchedule) -> dict[str, bool]:
    db.delete(schedule)
    db.commit()
    return {"deleted": True}


def calculate_next_run_at(schedule_type: str, schedule_value: str, current_time: datetime) -> datetime:
    current_time = _ensure_aware(current_time)

    if schedule_type == SCHEDULE_TYPE_INTERVAL_MINUTES:
        interval_minutes = int(schedule_value)
        return current_time + timedelta(minutes=interval_minutes)

    hour, minute = _parse_daily_time(schedule_value)
    candidate = current_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= current_time:
        candidate = candidate + timedelta(days=1)
    return candidate


def _validate_schedule_type_and_value(schedule_type: str, schedule_value: str) -> None:
    if schedule_type not in VALID_SCHEDULE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported schedule type",
        )

    if schedule_type == SCHEDULE_TYPE_INTERVAL_MINUTES:
        try:
            interval_minutes = int(schedule_value)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interval schedule value must be an integer minute count",
            ) from exc
        if interval_minutes <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Interval schedule value must be greater than 0",
            )
        return

    _parse_daily_time(schedule_value)


def _parse_daily_time(schedule_value: str) -> tuple[int, int]:
    try:
        hour_text, minute_text = schedule_value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Daily schedule value must use HH:MM format",
        ) from exc

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Daily schedule time must be a valid 24-hour time",
        )

    return hour, minute


def _validate_schedule_status(status_value: str) -> None:
    if status_value not in VALID_SCHEDULE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported schedule status",
        )


def _ensure_strategy_active(strategy_status: str) -> None:
    if strategy_status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active strategies can be scheduled",
        )


def _validate_precheck_strategy(db: Session, strategy_id: str | None) -> None:
    if not strategy_id:
        return
    strategy = get_strategy_or_404(db, strategy_id)
    _ensure_strategy_active(strategy.status)


def _normalize_precheck_config(value: dict | None) -> dict | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="precheck_config must be an object",
        )

    normalized: dict[str, float | int] = {}

    if "person_threshold" in value and value["person_threshold"] is not None:
        threshold = float(value["person_threshold"])
        if threshold < 0 or threshold > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="precheck_config.person_threshold must be between 0 and 1",
            )
        normalized["person_threshold"] = threshold

    if "soft_negative_threshold" in value and value["soft_negative_threshold"] is not None:
        threshold = float(value["soft_negative_threshold"])
        if threshold < 0 or threshold > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="precheck_config.soft_negative_threshold must be between 0 and 1",
            )
        normalized["soft_negative_threshold"] = threshold

    if "state_ttl_seconds" in value and value["state_ttl_seconds"] is not None:
        ttl_seconds = int(value["state_ttl_seconds"])
        if ttl_seconds < 1 or ttl_seconds > 3600:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="precheck_config.state_ttl_seconds must be between 1 and 3600",
            )
        normalized["state_ttl_seconds"] = ttl_seconds

    if "refresh_interval_seconds" in value and value["refresh_interval_seconds"] is not None:
        refresh_interval_seconds = int(value["refresh_interval_seconds"])
        if refresh_interval_seconds < 0 or refresh_interval_seconds > 86400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="precheck_config.refresh_interval_seconds must be between 0 and 86400",
            )
        normalized["refresh_interval_seconds"] = refresh_interval_seconds

    return normalized or None


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_datetime(value: str, *, field_name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be a valid ISO datetime string",
        ) from exc
    return _ensure_aware(parsed)


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return _ensure_aware(value).isoformat()
