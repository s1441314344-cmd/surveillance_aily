from fastapi import APIRouter

from app.schemas.job import JobScheduleCreate, JobScheduleRead, JobScheduleStatusUpdate, JobScheduleUpdate

router = APIRouter()


@router.get("", response_model=list[JobScheduleRead])
def list_job_schedules():
    return []


@router.post("", response_model=JobScheduleRead)
def create_job_schedule(payload: JobScheduleCreate):
    return JobScheduleRead(
        id="job-schedule-placeholder",
        camera_id=payload.camera_id,
        strategy_id=payload.strategy_id,
        schedule_type=payload.schedule_type,
        schedule_value=payload.schedule_value,
        status="active",
        next_run_at=None,
    )


@router.patch("/{schedule_id}", response_model=JobScheduleRead)
def update_job_schedule(schedule_id: str, payload: JobScheduleUpdate):
    return JobScheduleRead(
        id=schedule_id,
        camera_id=payload.camera_id or "camera-placeholder",
        strategy_id=payload.strategy_id or "strategy-placeholder",
        schedule_type=payload.schedule_type or "interval",
        schedule_value=payload.schedule_value or "60",
        status=payload.status or "active",
        next_run_at=None,
    )


@router.patch("/{schedule_id}/status", response_model=JobScheduleRead)
def update_job_schedule_status(schedule_id: str, payload: JobScheduleStatusUpdate):
    return JobScheduleRead(
        id=schedule_id,
        camera_id="camera-placeholder",
        strategy_id="strategy-placeholder",
        schedule_type="interval",
        schedule_value="60",
        status=payload.status,
        next_run_at=None,
    )
