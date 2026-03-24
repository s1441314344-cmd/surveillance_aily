import logging

from apscheduler.schedulers.blocking import BlockingScheduler

from app.core.config import get_settings
from app.core.database import SessionLocal, init_database
from app.services.bootstrap import seed_defaults
from app.services.scheduler_service import run_camera_status_sweep_once, run_due_job_schedules_once

logger = logging.getLogger(__name__)
settings = get_settings()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    init_database()
    with SessionLocal() as db:
        seed_defaults(db)

    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(
        _run_due_schedules,
        trigger="interval",
        seconds=settings.scheduler_poll_interval_seconds,
        id="surveillance-v2-job-schedules",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    if settings.scheduler_camera_status_sweep_enabled:
        scheduler.add_job(
            _run_camera_status_sweep,
            trigger="interval",
            seconds=settings.scheduler_camera_status_sweep_interval_seconds,
            id="surveillance-v2-camera-status-sweep",
            max_instances=1,
            coalesce=True,
            replace_existing=True,
        )

    logger.info("scheduler started with poll interval=%s seconds", settings.scheduler_poll_interval_seconds)
    if settings.scheduler_camera_status_sweep_enabled:
        logger.info(
            "camera status sweep enabled with interval=%s seconds",
            settings.scheduler_camera_status_sweep_interval_seconds,
        )
    else:
        logger.info("camera status sweep disabled")

    _run_due_schedules()
    if settings.scheduler_camera_status_sweep_enabled:
        _run_camera_status_sweep()
    scheduler.start()


def _run_due_schedules() -> None:
    created_job_ids = run_due_job_schedules_once()
    if created_job_ids:
        logger.info("triggered %s scheduled job(s): %s", len(created_job_ids), ", ".join(created_job_ids))


def _run_camera_status_sweep() -> None:
    summary = run_camera_status_sweep_once()
    if summary["total_count"] == 0:
        return
    logger.info(
        "camera status sweep finished: checked=%s failed=%s total=%s",
        summary["checked_count"],
        summary["failed_count"],
        summary["total_count"],
    )


if __name__ == "__main__":
    main()
