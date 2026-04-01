import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import get_settings
from app.core.database import SessionLocal, init_database
from app.services.feedback_training_pipeline_service import run_feedback_training_pipeline_once
from app.services.bootstrap import seed_defaults
from app.services.scheduler_service import (
    run_camera_status_sweep_once,
    run_due_alert_webhook_deliveries_once,
    run_due_job_schedules_once,
    run_due_signal_monitors_once,
)

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
    scheduler.add_job(
        _run_due_signal_monitors,
        trigger="interval",
        seconds=settings.scheduler_poll_interval_seconds,
        id="surveillance-v2-signal-monitors",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.add_job(
        _run_due_alert_webhooks,
        trigger="interval",
        seconds=max(int(settings.scheduler_poll_interval_seconds), 10),
        id="surveillance-v2-alert-webhooks",
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
    if settings.feedback_training_enabled:
        scheduler.add_job(
            _run_feedback_training_pipeline,
            trigger=_build_feedback_training_trigger(settings.feedback_training_cron),
            id="surveillance-v2-feedback-training",
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
    if settings.feedback_training_enabled:
        logger.info("feedback training scheduler enabled with cron=%s", settings.feedback_training_cron)
    else:
        logger.info("feedback training scheduler disabled")

    _run_due_schedules()
    _run_due_signal_monitors()
    _run_due_alert_webhooks()
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


def _run_due_signal_monitors() -> None:
    processed = run_due_signal_monitors_once()
    if processed:
        logger.info("processed signal monitor cycle for %s camera(s): %s", len(processed), ", ".join(processed))


def _run_due_alert_webhooks() -> None:
    delivered = run_due_alert_webhook_deliveries_once()
    if delivered:
        logger.info("processed alert webhook deliveries: %s", ", ".join(delivered))


def _run_feedback_training_pipeline() -> None:
    summary = run_feedback_training_pipeline_once(trigger_source="scheduler", triggered_by="scheduler")
    if summary.run_ids:
        logger.info(
            "feedback training pipeline runs created=%s run_ids=%s",
            len(summary.run_ids),
            ", ".join(summary.run_ids),
        )
    elif summary.skipped:
        logger.info("feedback training pipeline skipped: %s", summary.skipped)


def _build_feedback_training_trigger(cron_expression: str):
    try:
        return CronTrigger.from_crontab(cron_expression, timezone="UTC")
    except Exception:
        logger.warning("invalid FEEDBACK_TRAINING_CRON '%s', fallback to daily 02:00 UTC", cron_expression)
        return CronTrigger.from_crontab("0 2 * * *", timezone="UTC")


if __name__ == "__main__":
    main()
