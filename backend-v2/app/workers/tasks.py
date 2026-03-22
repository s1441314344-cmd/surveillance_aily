from app.core.celery_app import celery_app


@celery_app.task(name="jobs.process")
def process_job(job_id: str):
    return {"job_id": job_id, "status": "skeleton"}
