import csv
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import database_url
from app.models.task_record import TaskRecord
from app.schemas.task_record import TaskRecordRead


def serialize_task_record(record: TaskRecord) -> TaskRecordRead:
    created_at = None
    if record.created_at:
        created_at = (
            record.created_at.astimezone(timezone.utc)
            if record.created_at.tzinfo is not None
            else record.created_at.replace(tzinfo=timezone.utc)
        ).isoformat()

    return TaskRecordRead(
        id=record.id,
        job_id=record.job_id,
        strategy_id=record.strategy_id,
        strategy_name=record.strategy_name,
        strategy_snapshot=record.strategy_snapshot,
        input_file_asset_id=record.input_file_asset_id,
        input_filename=record.input_filename,
        input_image_path=record.input_image_path,
        preview_image_path=record.preview_image_path,
        source_type=record.source_type,
        camera_id=record.camera_id,
        model_provider=record.model_provider,
        model_name=record.model_name,
        raw_model_response=record.raw_model_response,
        normalized_json=record.normalized_json,
        result_status=record.result_status,
        duration_ms=record.duration_ms,
        feedback_status=record.feedback_status,
        created_at=created_at,
    )


def list_task_records(
    db: Session,
    *,
    result_status: str | None = None,
    strategy_id: str | None = None,
    job_id: str | None = None,
    camera_id: str | None = None,
    model_provider: str | None = None,
    feedback_status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> list[TaskRecordRead]:
    stmt = select(TaskRecord).order_by(TaskRecord.created_at.desc(), TaskRecord.id.desc())
    if result_status:
        stmt = stmt.where(TaskRecord.result_status == result_status)
    if strategy_id:
        stmt = stmt.where(TaskRecord.strategy_id == strategy_id)
    if job_id:
        stmt = stmt.where(TaskRecord.job_id == job_id)
    if camera_id:
        stmt = stmt.where(TaskRecord.camera_id == camera_id)
    if model_provider:
        stmt = stmt.where(TaskRecord.model_provider == model_provider)
    if feedback_status:
        stmt = stmt.where(TaskRecord.feedback_status == feedback_status)
    if created_from:
        stmt = stmt.where(TaskRecord.created_at >= _ensure_aware(created_from))
    if created_to:
        stmt = stmt.where(TaskRecord.created_at <= _ensure_aware(created_to))
    return [serialize_task_record(record) for record in db.scalars(stmt)]


def get_task_record_or_404(db: Session, record_id: str) -> TaskRecord:
    record = db.get(TaskRecord, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task record not found")
    return record


def export_task_records_csv(records: list[TaskRecordRead]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "record_id",
            "job_id",
            "created_at",
            "strategy_id",
            "strategy_name",
            "input_filename",
            "source_type",
            "model_provider",
            "model_name",
            "result_status",
            "feedback_status",
            "duration_ms",
        ]
    )

    for record in records:
        writer.writerow(
            [
                record.id,
                record.job_id,
                record.created_at or "",
                record.strategy_id,
                record.strategy_name,
                record.input_filename,
                record.source_type,
                record.model_provider,
                record.model_name,
                record.result_status,
                record.feedback_status,
                record.duration_ms,
            ]
        )

    return buffer.getvalue()


def get_record_image_path(record: TaskRecord) -> str:
    image_path = Path(record.input_image_path)
    if not record.input_image_path or not image_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found")
    return str(image_path)


def _ensure_aware(value: datetime) -> datetime:
    normalized = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if database_url.get_backend_name().startswith("sqlite"):
        return normalized.replace(tzinfo=None)
    return normalized
