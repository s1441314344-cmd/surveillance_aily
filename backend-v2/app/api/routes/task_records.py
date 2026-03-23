from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.task_record import TaskRecordRead
from app.services.task_record_service import (
    export_task_records_csv,
    get_record_image_path,
    get_task_record_or_404,
    list_task_records as list_task_record_rows,
    serialize_task_record,
)

router = APIRouter()


@router.get("", response_model=list[TaskRecordRead])
def list_task_records(
    status: str | None = None,
    strategy_id: str | None = None,
    job_id: str | None = None,
    camera_id: str | None = None,
    model_provider: str | None = None,
    feedback_status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_task_record_rows(
        db,
        result_status=status,
        strategy_id=strategy_id,
        job_id=job_id,
        camera_id=camera_id,
        model_provider=model_provider,
        feedback_status=feedback_status,
        created_from=created_from,
        created_to=created_to,
    )


@router.get("/export")
def export_task_records(
    status: str | None = None,
    strategy_id: str | None = None,
    job_id: str | None = None,
    camera_id: str | None = None,
    model_provider: str | None = None,
    feedback_status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = list_task_record_rows(
        db,
        result_status=status,
        strategy_id=strategy_id,
        job_id=job_id,
        camera_id=camera_id,
        model_provider=model_provider,
        feedback_status=feedback_status,
        created_from=created_from,
        created_to=created_to,
    )
    csv_content = export_task_records_csv(records)
    return PlainTextResponse(
        csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="task-records.csv"'},
    )


@router.get("/{record_id}/image")
def get_task_record_image(
    record_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = get_task_record_or_404(db, record_id)
    image_path = get_record_image_path(record)
    return FileResponse(image_path, filename=record.input_filename)


@router.get("/{record_id}", response_model=TaskRecordRead)
def get_task_record(
    record_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_task_record(get_task_record_or_404(db, record_id))
