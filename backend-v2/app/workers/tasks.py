from app.core.celery_app import celery_app
from app.services.job_execution_service import process_job as process_job_now


@celery_app.task(name="jobs.process")
def process_job(job_id: str):
    return process_job_now(job_id)
