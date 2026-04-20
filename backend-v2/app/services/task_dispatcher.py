from sqlalchemy.orm import Session


def dispatch_job_processing(*, job_id: str) -> str | None:
    from app.workers.tasks import process_job

    async_result = process_job.delay(job_id)
    return getattr(async_result, "id", None)


def dispatch_signal_monitor_cycle(
    *,
    db: Session,
    camera_id: str,
    dispatch: bool,
) -> None:
    if dispatch:
        from app.workers.tasks import process_camera_cycle

        process_camera_cycle.delay(camera_id, "signal_monitor")
        return

    from app.services.camera_signal_pipeline_service import process_camera_signal_cycle

    process_camera_signal_cycle(db, camera_id=camera_id, trigger_source="signal_monitor_inline")
