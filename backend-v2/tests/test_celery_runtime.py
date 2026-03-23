from app.core.celery_app import celery_app
from app.workers.tasks import process_job


def test_process_job_task_is_registered():
    assert process_job.name == "jobs.process"
    assert process_job.name in celery_app.tasks
