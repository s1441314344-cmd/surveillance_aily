from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.camera_signal_pipeline_service import process_camera_signal_cycle as process_camera_signal_cycle_now
from app.services.job_execution_service import process_job as process_job_now


@celery_app.task(name="jobs.process")
def process_job(job_id: str):
    return process_job_now(job_id)


@celery_app.task(name="signals.process_camera_cycle")
def process_camera_cycle(camera_id: str, trigger_source: str = "signal_monitor"):
    with SessionLocal() as db:
        return process_camera_signal_cycle_now(db, camera_id=camera_id, trigger_source=trigger_source)


def process_camera_signal_cycle(camera_id: str, trigger_source: str = "signal_monitor"):
    return process_camera_cycle(camera_id, trigger_source)
