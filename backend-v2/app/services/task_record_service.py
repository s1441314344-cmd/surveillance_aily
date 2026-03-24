import csv
from datetime import datetime, timezone
from io import BytesIO, StringIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from xml.sax.saxutils import escape

from app.core.config import get_settings
from app.core.database import database_url
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.schemas.task_record import TaskRecordRead

settings = get_settings()
EXPORT_HEADERS = [
    "record_id",
    "job_id",
    "job_type",
    "schedule_id",
    "created_at",
    "strategy_id",
    "strategy_name",
    "input_filename",
    "source_type",
    "camera_id",
    "model_provider",
    "model_name",
    "result_status",
    "feedback_status",
    "duration_ms",
]


def serialize_task_record(
    record: TaskRecord,
    *,
    job_type: str | None = None,
    schedule_id: str | None = None,
) -> TaskRecordRead:
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
        job_type=job_type,
        schedule_id=schedule_id,
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
    job_type: str | None = None,
    schedule_id: str | None = None,
    camera_id: str | None = None,
    model_provider: str | None = None,
    feedback_status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> list[TaskRecordRead]:
    requires_job_join = bool(job_type or schedule_id)
    stmt = select(TaskRecord)
    if requires_job_join:
        stmt = stmt.join(Job, Job.id == TaskRecord.job_id)
    if result_status:
        stmt = stmt.where(TaskRecord.result_status == result_status)
    if strategy_id:
        stmt = stmt.where(TaskRecord.strategy_id == strategy_id)
    if job_id:
        stmt = stmt.where(TaskRecord.job_id == job_id)
    if job_type:
        stmt = stmt.where(Job.job_type == job_type)
    if schedule_id:
        stmt = stmt.where(Job.schedule_id == schedule_id)
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
    stmt = stmt.order_by(TaskRecord.created_at.desc(), TaskRecord.id.desc())
    records = list(db.scalars(stmt))
    runtime_map = _build_job_runtime_map(
        db,
        {record.job_id for record in records},
    )
    return [
        serialize_task_record(
            record,
            job_type=runtime_map.get(record.job_id, {}).get("job_type"),
            schedule_id=runtime_map.get(record.job_id, {}).get("schedule_id"),
        )
        for record in records
    ]


def get_task_record_or_404(db: Session, record_id: str) -> TaskRecord:
    record = db.get(TaskRecord, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task record not found")
    return record


def get_task_record_read(db: Session, record: TaskRecord) -> TaskRecordRead:
    runtime = _build_job_runtime_map(db, {record.job_id}).get(record.job_id, {})
    return serialize_task_record(
        record,
        job_type=runtime.get("job_type"),
        schedule_id=runtime.get("schedule_id"),
    )


def export_task_records_csv(records: list[TaskRecordRead]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_HEADERS)

    for record in records:
        writer.writerow(
            [
                record.id,
                record.job_id,
                record.job_type or "",
                record.schedule_id or "",
                record.created_at or "",
                record.strategy_id,
                record.strategy_name,
                record.input_filename,
                record.source_type,
                record.camera_id or "",
                record.model_provider,
                record.model_name,
                record.result_status,
                record.feedback_status,
                record.duration_ms,
            ]
        )

    return buffer.getvalue()


def export_task_records_xlsx(records: list[TaskRecordRead]) -> bytes:
    rows: list[list[str | int]] = [EXPORT_HEADERS]
    rows.extend(
        [
            [
                record.id,
                record.job_id,
                record.job_type or "",
                record.schedule_id or "",
                record.created_at or "",
                record.strategy_id,
                record.strategy_name,
                record.input_filename,
                record.source_type,
                record.camera_id or "",
                record.model_provider,
                record.model_name,
                record.result_status,
                record.feedback_status,
                record.duration_ms,
            ]
            for record in records
        ]
    )

    worksheet_rows = []
    for index, row in enumerate(rows, start=1):
        worksheet_rows.append(f'<row r="{index}">{_xlsx_row_cells(row)}</row>')

    worksheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheetData>{''.join(worksheet_rows)}</sheetData>"
        "</worksheet>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            "<sheets>"
            '<sheet name="task_records" sheetId="1" r:id="rId1"/>'
            "</sheets>"
            "</workbook>",
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            'Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
            'Target="styles.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "xl/styles.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
            '<fills count="2"><fill><patternFill patternType="none"/></fill>'
            '<fill><patternFill patternType="gray125"/></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            "</styleSheet>",
        )
        archive.writestr("xl/worksheets/sheet1.xml", worksheet_xml)

    return buffer.getvalue()


def get_record_image_path(record: TaskRecord) -> str:
    image_path = Path(record.input_image_path)
    if not record.input_image_path or not image_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image file not found")

    storage_root = Path(settings.storage_root).resolve()
    resolved_path = image_path.resolve()
    try:
        resolved_path.relative_to(storage_root)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Image file access denied") from exc
    return str(resolved_path)


def _ensure_aware(value: datetime) -> datetime:
    normalized = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if database_url.get_backend_name().startswith("sqlite"):
        return normalized.replace(tzinfo=None)
    return normalized


def _xlsx_row_cells(values: list[str | int]) -> str:
    return "".join(_xlsx_cell(value) for value in values)


def _xlsx_cell(value: str | int) -> str:
    if isinstance(value, int):
        return f"<c><v>{value}</v></c>"
    safe_text = escape(str(value)).replace("\r\n", "\n").replace("\r", "\n")
    return f'<c t="inlineStr"><is><t xml:space="preserve">{safe_text}</t></is></c>'


def _build_job_runtime_map(db: Session, job_ids: set[str]) -> dict[str, dict[str, str | None]]:
    if not job_ids:
        return {}
    stmt = select(Job.id, Job.job_type, Job.schedule_id).where(Job.id.in_(job_ids))
    return {
        job_id: {
            "job_type": job_type,
            "schedule_id": schedule_id,
        }
        for job_id, job_type, schedule_id in db.execute(stmt)
    }
