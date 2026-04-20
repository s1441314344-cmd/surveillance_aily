import json
import time
from pathlib import Path
from typing import Callable

from sqlalchemy.orm import Session

from app.models.file_asset import FileAsset
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.services.ids import generate_id
from app.services.version_recognition_attempt_service import run_version_recognition_attempts


def process_version_recognition_job(
    db: Session,
    job: Job,
    *,
    job_cancelled: Callable[[Session, str], bool],
    finish_job: Callable[..., None],
    create_failed_upload_record: Callable[..., None],
) -> None:
    payload = job.payload or {}
    strategy_snapshot = payload.get("strategy_snapshot") or {}
    asset_ids = [str(item) for item in payload.get("input_asset_ids") or []]
    input_file_names = [str(item) for item in payload.get("input_file_names") or []]

    if not strategy_snapshot or not asset_ids:
        finish_job(db, job, status="failed", error_message="Job payload is incomplete")
        return

    if job_cancelled(db, job.id):
        finish_job(db, job, status="cancelled", error_message=job.error_message)
        return

    started_at = time.perf_counter()
    asset_id = asset_ids[0]
    display_name = input_file_names[0] if input_file_names else "unnamed"
    file_asset = db.get(FileAsset, asset_id)
    if file_asset is None:
        create_failed_upload_record(
            db,
            job=job,
            strategy_snapshot=strategy_snapshot,
            input_filename=display_name,
            source_type="upload",
            camera_id=None,
            error_message="Input asset not found",
            duration_ms=int((time.perf_counter() - started_at) * 1000),
        )
        db.commit()
        finish_job(db, job, status="failed", error_message=job.error_message)
        return

    asset_path = Path(file_asset.storage_path)
    if not asset_path.exists() or asset_path.stat().st_size == 0:
        create_failed_upload_record(
            db,
            job=job,
            strategy_snapshot=strategy_snapshot,
            input_filename=file_asset.original_name,
            source_type="upload",
            camera_id=None,
            error_message="Input asset is missing or empty",
            duration_ms=int((time.perf_counter() - started_at) * 1000),
        )
        db.commit()
        finish_job(db, job, status="failed", error_message=job.error_message)
        return

    try:
        image_bytes = asset_path.read_bytes()
        attempt_result = run_version_recognition_attempts(
            image_bytes=image_bytes,
            original_name=file_asset.original_name,
        )
    except Exception as exc:
        create_failed_upload_record(
            db,
            job=job,
            strategy_snapshot=strategy_snapshot,
            input_filename=file_asset.original_name,
            source_type="upload",
            camera_id=None,
            error_message=str(exc),
            duration_ms=int((time.perf_counter() - started_at) * 1000),
        )
        db.commit()
        finish_job(db, job, status="failed", error_message=job.error_message)
        return

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    task_record = TaskRecord(
        id=generate_id(),
        job_id=job.id,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        strategy_snapshot=strategy_snapshot,
        input_file_asset_id=file_asset.id,
        input_filename=file_asset.original_name,
        input_image_path=file_asset.storage_path,
        preview_image_path=None,
        source_type="upload",
        camera_id=None,
        model_provider=job.model_provider,
        model_name=job.model_name,
        raw_model_response=json.dumps(
            {
                "attempts": attempt_result.ocr_attempt_payloads,
                "attempt_count": len(attempt_result.ocr_attempt_payloads),
            },
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        ),
        normalized_json=attempt_result.normalized_json,
        result_status="completed",
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)
    job.completed_items += 1
    db.commit()
    finish_job(db, job, status="completed", error_message=None)
