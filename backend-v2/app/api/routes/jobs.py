from fastapi import APIRouter

from app.schemas.job import JobCameraOnceCreate, JobRead, JobUploadCreateResponse

router = APIRouter()


@router.post("/uploads", response_model=JobUploadCreateResponse)
def create_upload_job():
    return JobUploadCreateResponse(job_id="job-upload-placeholder", status="queued")


@router.post("/cameras/once", response_model=JobRead)
def create_camera_once_job(payload: JobCameraOnceCreate):
    return JobRead(
        id="job-camera-once-placeholder",
        job_type="camera_once",
        trigger_mode="manual",
        strategy_id=payload.strategy_id,
        camera_id=payload.camera_id,
        model_provider=payload.model_provider or "zhipu",
        model_name=payload.model_name or "glm-4v-plus",
        status="queued",
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
    )


@router.get("", response_model=list[JobRead])
def list_jobs():
    return []


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str):
    return JobRead(
        id=job_id,
        job_type="upload_single",
        trigger_mode="manual",
        strategy_id="strategy-placeholder",
        camera_id=None,
        model_provider="zhipu",
        model_name="glm-4v-plus",
        status="queued",
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
    )


@router.post("/{job_id}/cancel", response_model=JobRead)
def cancel_job(job_id: str):
    return JobRead(
        id=job_id,
        job_type="upload_single",
        trigger_mode="manual",
        strategy_id="strategy-placeholder",
        camera_id=None,
        model_provider="zhipu",
        model_name="glm-4v-plus",
        status="cancelled",
        total_items=1,
        completed_items=0,
        failed_items=0,
        error_message=None,
    )
