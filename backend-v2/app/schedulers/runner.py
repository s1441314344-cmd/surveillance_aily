import logging

from apscheduler.schedulers.blocking import BlockingScheduler

from app.core.config import get_settings
from app.core.database import SessionLocal, init_database
from app.services.bootstrap import seed_defaults
from app.services.scheduler_service import run_due_job_schedules_once

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

    logger.info("scheduler started with poll interval=%s seconds", settings.scheduler_poll_interval_seconds)
    _run_due_schedules()
    scheduler.start()


def _run_due_schedules() -> None:
    created_job_ids = run_due_job_schedules_once()
    if created_job_ids:
        logger.info("triggered %s scheduled job(s): %s", len(created_job_ids), ", ".join(created_job_ids))


if __name__ == "__main__":
    main()
