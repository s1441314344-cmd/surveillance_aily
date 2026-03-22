from fastapi import APIRouter

from app.schemas.task_record import TaskRecordRead

router = APIRouter()


@router.get("", response_model=list[TaskRecordRead])
def list_task_records():
    return []


@router.get("/export")
def export_task_records():
    return {"message": "CSV export placeholder"}


@router.get("/{record_id}", response_model=TaskRecordRead)
def get_task_record(record_id: str):
    return TaskRecordRead(
        id=record_id,
        job_id="job-placeholder",
        strategy_snapshot={"name": "占位策略"},
        input_image_path="./data/storage/input/example.jpg",
        preview_image_path=None,
        source_type="upload",
        camera_id=None,
        model_provider="zhipu",
        model_name="glm-4v-plus",
        raw_model_response="{}",
        normalized_json={},
        result_status="completed",
        duration_ms=0,
        feedback_status="unreviewed",
    )
