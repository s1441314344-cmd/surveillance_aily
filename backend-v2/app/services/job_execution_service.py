import json
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.file_asset import FileAsset
from app.models.job import Job, JobSchedule
from app.models.task_record import TaskRecord
from app.services.ocr_service import recognize_with_ocr_service
from app.services.camera_capture_service import (
    CameraCaptureError,
    capture_camera_frame,
    snapshot_to_capture_config,
)
from app.services.camera_roi_service import CameraRoiError, apply_analysis_roi_to_frame
from app.services.ids import generate_id
from app.services.model_call_log_service import build_model_call_details, create_model_call_log
from app.services.providers.base import ProviderRequest
from app.services.providers.factory import get_provider_adapter
from app.services.storage import FileStorageService
from app.services.version_recognition_extractor import (
    crop_image_by_roi,
    crop_image_for_template,
    extract_version_recognition_result,
    rotate_image_bytes,
)
from app.services.version_recognition_templates import DEFAULT_VERSION_RECOGNITION_TEMPLATE

try:
    from jsonschema import Draft202012Validator
except Exception:  # pragma: no cover - optional dependency guard
    Draft202012Validator = None

JOB_STATUS_COMPLETED = "completed"
JOB_STATUS_FAILED = "failed"
JOB_STATUS_CANCELLED = "cancelled"
JOB_STATUS_RUNNING = "running"
JOB_STATUS_TERMINAL = {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}
RECORD_STATUS_SCHEMA_INVALID = "schema_invalid"
SCHEMA_INVALID_ERROR_MARKERS = (
    "invalid json payload",
    "valid json content",
    "json decode",
    "json parse",
    "json schema",
    "schema validation",
    "structured output",
)


def process_job(job_id: str) -> dict[str, str]:
    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if job is None:
            return {"job_id": job_id, "status": "missing"}

        if job.status in JOB_STATUS_TERMINAL:
            return {"job_id": job.id, "status": job.status}

        job.status = JOB_STATUS_RUNNING
        if job.started_at is None:
            job.started_at = _utcnow()
        job.finished_at = None
        db.commit()
        db.refresh(job)

        try:
            if job.job_type in {"upload_single", "upload_batch"}:
                _process_upload_job(db, job)
            elif job.job_type == "version_recognition_upload":
                _process_version_recognition_job(db, job)
            elif job.job_type in {"camera_once", "camera_schedule"}:
                _process_camera_job(db, job)
            else:
                _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=f"Unsupported job type: {job.job_type}")
        except Exception as exc:  # pragma: no cover - safety fallback
            _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=f"Job execution failed: {exc}")

        db.refresh(job)
        return {"job_id": job.id, "status": job.status}


def _process_upload_job(db: Session, job: Job) -> None:
    payload = job.payload or {}
    strategy_snapshot = payload.get("strategy_snapshot") or {}
    source_type = str(payload.get("source_type") or "upload")
    normalized_source_type = "upload" if source_type.startswith("upload") else source_type
    asset_ids = [str(item) for item in payload.get("input_asset_ids") or []]
    input_file_names = [str(item) for item in payload.get("input_file_names") or []]

    if not strategy_snapshot or not asset_ids:
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message="Job payload is incomplete")
        return

    adapter = get_provider_adapter(job.model_provider)

    for index, asset_id in enumerate(asset_ids):
        if _job_cancelled(db, job.id):
            _finish_job(db, job, status=JOB_STATUS_CANCELLED, error_message=job.error_message)
            return

        started_at = time.perf_counter()
        file_asset = db.get(FileAsset, asset_id)
        display_name = input_file_names[index] if index < len(input_file_names) else "unnamed"

        if file_asset is None:
            _create_failed_upload_record(
                db,
                job=job,
                strategy_snapshot=strategy_snapshot,
                input_filename=display_name,
                source_type=normalized_source_type,
                camera_id=job.camera_id,
                error_message="Input asset not found",
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )
            db.commit()
            continue

        asset_path = Path(file_asset.storage_path)
        if not asset_path.exists() or asset_path.stat().st_size == 0:
            _create_failed_upload_record(
                db,
                job=job,
                strategy_snapshot=strategy_snapshot,
                input_filename=file_asset.original_name,
                source_type=normalized_source_type,
                camera_id=job.camera_id,
                error_message="Input asset is missing or empty",
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )
            db.commit()
            continue

        model_input_path = _convert_upload_image_to_png_for_model(job_id=job.id, input_path=file_asset.storage_path)
        provider_response = adapter.analyze(
            ProviderRequest(
                model=job.model_name,
                prompt=strategy_snapshot["prompt_template"],
                image_paths=[model_input_path],
                response_format=str(strategy_snapshot.get("result_format") or "json_schema"),
                response_schema=strategy_snapshot["response_schema"],
            )
        )
        create_model_call_log(
            db,
            provider=job.model_provider,
            model_name=job.model_name,
            trigger_type="job_upload",
            trigger_source=job.job_type,
            response_format=str(strategy_snapshot.get("result_format") or "json_schema"),
            success=provider_response.success,
            error_message=provider_response.error_message,
            usage=provider_response.usage,
            input_image_count=1,
            job_id=job.id,
            schedule_id=job.schedule_id,
            camera_id=job.camera_id,
            strategy_id=job.strategy_id,
            details=build_model_call_details(
                prompt=str(strategy_snapshot.get("prompt_template") or ""),
                response_format=str(strategy_snapshot.get("result_format") or "json_schema"),
                image_paths=[model_input_path],
                input_summary={
                    "input_filename": file_asset.original_name,
                    "job_type": job.job_type,
                },
                raw_response=provider_response.raw_response,
                normalized_json=provider_response.normalized_json,
                error_message=provider_response.error_message,
                context={
                    "job_id": job.id,
                    "schedule_id": job.schedule_id,
                    "camera_id": job.camera_id,
                    "strategy_id": job.strategy_id,
                },
            ),
        )
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        result_status, record_error_message = _resolve_task_record_status(
            provider_success=provider_response.success,
            normalized_json=provider_response.normalized_json,
            raw_response=provider_response.raw_response,
            error_message=provider_response.error_message,
            result_format=str(strategy_snapshot.get("result_format") or "json_schema"),
            response_schema=strategy_snapshot.get("response_schema"),
        )

        task_record = TaskRecord(
            id=generate_id(),
            job_id=job.id,
            strategy_id=job.strategy_id,
            strategy_name=job.strategy_name,
            strategy_snapshot=strategy_snapshot,
            input_file_asset_id=file_asset.id,
            input_filename=file_asset.original_name,
            input_image_path=model_input_path,
            preview_image_path=None,
            source_type=normalized_source_type,
            camera_id=job.camera_id,
            model_provider=job.model_provider,
            model_name=job.model_name,
            raw_model_response=provider_response.raw_response or "",
            normalized_json=provider_response.normalized_json,
            result_status=result_status,
            duration_ms=duration_ms,
            feedback_status="unreviewed",
        )
        db.add(task_record)

        if result_status == JOB_STATUS_COMPLETED:
            job.completed_items += 1
        else:
            job.failed_items += 1
            if not job.error_message:
                job.error_message = record_error_message
        db.commit()

    if _job_cancelled(db, job.id):
        _finish_job(db, job, status=JOB_STATUS_CANCELLED, error_message=job.error_message)
        return

    if job.failed_items > 0 and job.completed_items == 0:
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=job.error_message)
        return

    _finish_job(db, job, status=JOB_STATUS_COMPLETED, error_message=job.error_message)


def _convert_upload_image_to_png_for_model(*, job_id: str, input_path: str) -> str:
    path = Path(input_path)
    if path.suffix.lower() == ".png":
        return str(path)

    try:
        with Image.open(path) as image:
            converted = image.convert("RGB")
            buffer = BytesIO()
            converted.save(buffer, format="PNG")
        storage = FileStorageService()
        return storage.save_bytes(buffer.getvalue(), f"{path.stem}.png", folder=f"jobs/{job_id}/model-inputs")
    except Exception:
        # Keep backward-compatible behavior for invalid image bytes in tests/legacy data.
        return str(path)


def _process_camera_job(db: Session, job: Job) -> None:
    payload = job.payload or {}
    strategy_snapshot = payload.get("strategy_snapshot") or {}
    camera_snapshot = payload.get("camera_snapshot") or {}

    if not strategy_snapshot or not camera_snapshot:
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message="Job payload is incomplete")
        _sync_schedule_error_state(db, job, "Job payload is incomplete")
        return

    if _job_cancelled(db, job.id):
        _finish_job(db, job, status=JOB_STATUS_CANCELLED, error_message=job.error_message)
        return

    adapter = get_provider_adapter(job.model_provider)
    started_at = time.perf_counter()

    try:
        captured_frame = capture_camera_frame(snapshot_to_capture_config(camera_snapshot))
    except CameraCaptureError as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        _create_failed_camera_record(
            db,
            job=job,
            strategy_snapshot=strategy_snapshot,
            camera_snapshot=camera_snapshot,
            error_message=str(exc),
            duration_ms=duration_ms,
        )
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=str(exc))
        _sync_schedule_error_state(db, job, str(exc))
        return

    try:
        captured_frame, _applied_roi = apply_analysis_roi_to_frame(
            captured_frame,
            camera_snapshot.get("analysis_roi"),
        )
    except CameraRoiError as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        _create_failed_camera_record(
            db,
            job=job,
            strategy_snapshot=strategy_snapshot,
            camera_snapshot=camera_snapshot,
            error_message=str(exc),
            duration_ms=duration_ms,
        )
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=str(exc))
        _sync_schedule_error_state(db, job, str(exc))
        return

    if _job_cancelled(db, job.id):
        _finish_job(db, job, status=JOB_STATUS_CANCELLED, error_message=job.error_message)
        return

    storage_root = str(camera_snapshot.get("storage_path") or "")
    storage = FileStorageService(root=storage_root or None)
    storage_path = storage.save_bytes(captured_frame.content, captured_frame.original_name, folder=f"captures/{job.id}")
    file_asset = FileAsset(
        id=generate_id(),
        purpose="camera_frame",
        original_name=captured_frame.original_name,
        storage_path=storage_path,
        mime_type=captured_frame.mime_type,
    )
    db.add(file_asset)
    db.flush()

    provider_response = adapter.analyze(
        ProviderRequest(
            model=job.model_name,
            prompt=strategy_snapshot["prompt_template"],
            image_paths=[storage_path],
            response_format=str(strategy_snapshot.get("result_format") or "json_schema"),
            response_schema=strategy_snapshot["response_schema"],
        )
    )
    create_model_call_log(
        db,
        provider=job.model_provider,
        model_name=job.model_name,
        trigger_type="job_camera",
        trigger_source=job.job_type,
        response_format=str(strategy_snapshot.get("result_format") or "json_schema"),
        success=provider_response.success,
        error_message=provider_response.error_message,
        usage=provider_response.usage,
        input_image_count=1,
        job_id=job.id,
        schedule_id=job.schedule_id,
        camera_id=job.camera_id,
        strategy_id=job.strategy_id,
        details=build_model_call_details(
            prompt=str(strategy_snapshot.get("prompt_template") or ""),
            response_format=str(strategy_snapshot.get("result_format") or "json_schema"),
            image_paths=[storage_path],
            input_summary={
                "camera_name": camera_snapshot.get("name"),
                "job_type": job.job_type,
            },
            raw_response=provider_response.raw_response,
            normalized_json=provider_response.normalized_json,
            error_message=provider_response.error_message,
            context={
                "job_id": job.id,
                "schedule_id": job.schedule_id,
                "camera_id": job.camera_id,
                "strategy_id": job.strategy_id,
            },
        ),
    )
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    result_status, record_error_message = _resolve_task_record_status(
        provider_success=provider_response.success,
        normalized_json=provider_response.normalized_json,
        raw_response=provider_response.raw_response,
        error_message=provider_response.error_message,
        result_format=str(strategy_snapshot.get("result_format") or "json_schema"),
        response_schema=strategy_snapshot.get("response_schema"),
    )

    task_record = TaskRecord(
        id=generate_id(),
        job_id=job.id,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        strategy_snapshot=strategy_snapshot,
        input_file_asset_id=file_asset.id,
        input_filename=file_asset.original_name,
        input_image_path=storage_path,
        preview_image_path=None,
        source_type="camera",
        camera_id=job.camera_id,
        model_provider=job.model_provider,
        model_name=job.model_name,
        raw_model_response=provider_response.raw_response or "",
        normalized_json=provider_response.normalized_json,
        result_status=result_status,
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)

    if result_status == JOB_STATUS_COMPLETED:
        job.completed_items += 1
        db.commit()
        _finish_job(db, job, status=JOB_STATUS_COMPLETED, error_message=None)
        _sync_schedule_error_state(db, job, None)
        return

    job.failed_items += 1
    if not job.error_message:
        job.error_message = record_error_message
    db.commit()
    _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=job.error_message)
    _sync_schedule_error_state(db, job, job.error_message)


def _process_version_recognition_job(db: Session, job: Job) -> None:
    payload = job.payload or {}
    strategy_snapshot = payload.get("strategy_snapshot") or {}
    asset_ids = [str(item) for item in payload.get("input_asset_ids") or []]
    input_file_names = [str(item) for item in payload.get("input_file_names") or []]

    if not strategy_snapshot or not asset_ids:
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message="Job payload is incomplete")
        return

    if _job_cancelled(db, job.id):
        _finish_job(db, job, status=JOB_STATUS_CANCELLED, error_message=job.error_message)
        return

    started_at = time.perf_counter()
    asset_id = asset_ids[0]
    display_name = input_file_names[0] if input_file_names else "unnamed"
    file_asset = db.get(FileAsset, asset_id)
    if file_asset is None:
        _create_failed_upload_record(
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
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=job.error_message)
        return

    asset_path = Path(file_asset.storage_path)
    if not asset_path.exists() or asset_path.stat().st_size == 0:
        _create_failed_upload_record(
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
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=job.error_message)
        return

    try:
        image_bytes = asset_path.read_bytes()
        ocr_attempt_payloads: list[dict] = []
        combined_lines: list[dict] = []
        roi_applied = False

        def run_ocr_attempt(
            *,
            scope: str,
            attempt_bytes: bytes,
            attempt_filename: str,
            required: bool,
        ) -> bool:
            try:
                ocr_result = recognize_with_ocr_service(
                    image_bytes=attempt_bytes,
                    filename=attempt_filename,
                    template=DEFAULT_VERSION_RECOGNITION_TEMPLATE,
                )
            except Exception as exc:
                ocr_attempt_payloads.append({"scope": scope, "error": str(exc)})
                if required:
                    raise
                return False

            ocr_attempt_payloads.append({"scope": scope, "payload": ocr_result.raw_payload})
            combined_lines.extend(ocr_result.lines)
            return True

        try:
            center_roi_bytes = crop_image_for_template(
                image_bytes=image_bytes,
                template=DEFAULT_VERSION_RECOGNITION_TEMPLATE,
            )
            if run_ocr_attempt(
                scope="roi_center",
                attempt_bytes=center_roi_bytes,
                attempt_filename=f"roi-center-{file_asset.original_name}",
                required=False,
            ):
                roi_applied = True
        except Exception:
            pass

        for roi_name, roi in DEFAULT_VERSION_RECOGNITION_TEMPLATE.fallback_rois:
            try:
                roi_bytes = crop_image_by_roi(image_bytes=image_bytes, roi=roi)
            except Exception:
                continue
            if run_ocr_attempt(
                scope=f"roi_{roi_name}",
                attempt_bytes=roi_bytes,
                attempt_filename=f"roi-{roi_name}-{file_asset.original_name}",
                required=False,
            ):
                roi_applied = True

        run_ocr_attempt(
            scope="full",
            attempt_bytes=image_bytes,
            attempt_filename=file_asset.original_name,
            required=True,
        )
        normalized_json = extract_version_recognition_result(
            lines=combined_lines,
            template=DEFAULT_VERSION_RECOGNITION_TEMPLATE,
            roi_applied=roi_applied,
            context_hint=file_asset.original_name,
        )
        initial_version = normalized_json.get("recognized_version")

        if normalized_json.get("extraction_status") in {"not_found", "ambiguous"}:
            for angle in DEFAULT_VERSION_RECOGNITION_TEMPLATE.rotation_angles:
                rotated_bytes = rotate_image_bytes(image_bytes=image_bytes, angle=angle)
                run_ocr_attempt(
                    scope=f"full_rotated_{angle}",
                    attempt_bytes=rotated_bytes,
                    attempt_filename=f"rot{angle}-{file_asset.original_name}",
                    required=False,
                )
            normalized_json = extract_version_recognition_result(
                lines=combined_lines,
                template=DEFAULT_VERSION_RECOGNITION_TEMPLATE,
                roi_applied=roi_applied,
                context_hint=file_asset.original_name,
            )
            if normalized_json.get("extraction_status") == "matched":
                normalized_json["summary"] = (
                    f"{normalized_json.get('summary') or '已识别版本号'}（通过旋转回退命中）"
                )

        if normalized_json.get("extraction_status") in {"not_found", "ambiguous"}:
            upscaled_bytes = _upscale_image_bytes(image_bytes=image_bytes, scale=2.0, max_side=4096)
            run_ocr_attempt(
                scope="full_upscaled_x2",
                attempt_bytes=upscaled_bytes,
                attempt_filename=f"upscaled-{file_asset.original_name}",
                required=False,
            )
            for angle in DEFAULT_VERSION_RECOGNITION_TEMPLATE.rotation_angles:
                upscaled_rotated = rotate_image_bytes(image_bytes=upscaled_bytes, angle=angle)
                run_ocr_attempt(
                    scope=f"full_upscaled_x2_rotated_{angle}",
                    attempt_bytes=upscaled_rotated,
                    attempt_filename=f"upscaled-rot{angle}-{file_asset.original_name}",
                    required=False,
                )
            normalized_json = extract_version_recognition_result(
                lines=combined_lines,
                template=DEFAULT_VERSION_RECOGNITION_TEMPLATE,
                roi_applied=roi_applied,
                context_hint=file_asset.original_name,
            )
            if normalized_json.get("extraction_status") == "matched":
                normalized_json["summary"] = (
                    f"{normalized_json.get('summary') or '已识别版本号'}（通过放大/旋转回退命中）"
                )
            elif normalized_json.get("extraction_status") == "not_found":
                normalized_json["summary"] = (
                    "未识别到版本号（已尝试中心ROI、四角ROI、全图、旋转与放大回退）"
                )

        if (
            normalized_json.get("extraction_status") == "matched"
            and initial_version
            and normalized_json.get("recognized_version") != initial_version
        ):
            normalized_json["summary"] = (
                f"已识别版本号：{normalized_json.get('recognized_version')}（通过多路回退校正）"
            )
    except Exception as exc:
        _create_failed_upload_record(
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
        _finish_job(db, job, status=JOB_STATUS_FAILED, error_message=job.error_message)
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
                "attempts": ocr_attempt_payloads,
                "attempt_count": len(ocr_attempt_payloads),
            },
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        ),
        normalized_json=normalized_json,
        result_status=JOB_STATUS_COMPLETED,
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)
    job.completed_items += 1
    db.commit()
    _finish_job(db, job, status=JOB_STATUS_COMPLETED, error_message=None)



def _job_cancelled(db: Session, job_id: str) -> bool:
    db.expire_all()
    current_job = db.get(Job, job_id)
    return current_job is not None and current_job.status == JOB_STATUS_CANCELLED


def _finish_job(db: Session, job: Job, *, status: str, error_message: str | None) -> None:
    db.expire_all()
    current_job = db.get(Job, job.id)
    if current_job is None:
        return

    current_job.status = status
    current_job.error_message = error_message
    if current_job.finished_at is None:
        current_job.finished_at = _utcnow()
    db.commit()


def _create_failed_upload_record(
    db: Session,
    *,
    job: Job,
    strategy_snapshot: dict,
    input_filename: str,
    source_type: str,
    camera_id: str | None,
    error_message: str,
    duration_ms: int,
) -> None:
    task_record = TaskRecord(
        id=generate_id(),
        job_id=job.id,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        strategy_snapshot=strategy_snapshot,
        input_file_asset_id=None,
        input_filename=input_filename,
        input_image_path="",
        preview_image_path=None,
        source_type=source_type,
        camera_id=camera_id,
        model_provider=job.model_provider,
        model_name=job.model_name,
        raw_model_response=error_message,
        normalized_json=None,
        result_status=JOB_STATUS_FAILED,
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)
    job.failed_items += 1
    if not job.error_message:
        job.error_message = error_message


def _create_failed_camera_record(
    db: Session,
    *,
    job: Job,
    strategy_snapshot: dict,
    camera_snapshot: dict,
    error_message: str,
    duration_ms: int,
) -> None:
    task_record = TaskRecord(
        id=generate_id(),
        job_id=job.id,
        strategy_id=job.strategy_id,
        strategy_name=job.strategy_name,
        strategy_snapshot=strategy_snapshot,
        input_file_asset_id=None,
        input_filename=f"{camera_snapshot.get('name') or 'camera'}.jpg",
        input_image_path="",
        preview_image_path=None,
        source_type="camera",
        camera_id=job.camera_id,
        model_provider=job.model_provider,
        model_name=job.model_name,
        raw_model_response=error_message,
        normalized_json=None,
        result_status=JOB_STATUS_FAILED,
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)
    job.failed_items += 1
    if not job.error_message:
        job.error_message = error_message
    db.commit()


def _sync_schedule_error_state(db: Session, job: Job, error_message: str | None) -> None:
    if not job.schedule_id:
        return

    schedule = db.get(JobSchedule, job.schedule_id)
    if schedule is None:
        return

    schedule.last_error = error_message
    db.commit()


def _resolve_task_record_status(
    *,
    provider_success: bool,
    normalized_json: dict | None,
    raw_response: str,
    error_message: str | None,
    result_format: str,
    response_schema: dict | None,
) -> tuple[str, str | None]:
    normalized_result_format = (result_format or "json_schema").strip().lower()
    if provider_success:
        if normalized_result_format in {"json_schema", "json_object"} and not isinstance(normalized_json, dict):
            return RECORD_STATUS_SCHEMA_INVALID, "Model did not produce a structured JSON object"
        if normalized_result_format == "json_schema":
            schema_error = _validate_schema_output(normalized_json, response_schema)
            if schema_error:
                return RECORD_STATUS_SCHEMA_INVALID, f"Model response failed schema validation: {schema_error}"
        return JOB_STATUS_COMPLETED, None

    resolved_error = error_message or raw_response or "Model analysis failed"
    if _is_schema_invalid_failure(error_message, raw_response):
        return RECORD_STATUS_SCHEMA_INVALID, resolved_error
    return JOB_STATUS_FAILED, resolved_error


def _validate_schema_output(result: dict, response_schema: dict | None) -> str | None:
    if not response_schema or Draft202012Validator is None:
        return None

    try:
        validator = Draft202012Validator(response_schema)
    except Exception:
        return None

    errors = sorted(
        validator.iter_errors(result),
        key=lambda item: [str(path_item) for path_item in item.absolute_path],
    )
    if not errors:
        return None

    first_error = errors[0]
    field_path = ".".join(str(path_item) for path_item in first_error.absolute_path)
    location = field_path or "$"
    return f"{location}: {first_error.message}"


def _is_schema_invalid_failure(error_message: str | None, raw_response: str) -> bool:
    combined = f"{error_message or ''} {raw_response or ''}".lower()
    return any(marker in combined for marker in SCHEMA_INVALID_ERROR_MARKERS)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _upscale_image_bytes(*, image_bytes: bytes, scale: float, max_side: int) -> bytes:
    image = Image.open(BytesIO(image_bytes))
    width, height = image.size
    if width <= 0 or height <= 0:
        return image_bytes

    target_width = int(width * scale)
    target_height = int(height * scale)
    longest = max(target_width, target_height)
    if longest > max_side:
        resize_ratio = max_side / float(longest)
        target_width = max(1, int(target_width * resize_ratio))
        target_height = max(1, int(target_height * resize_ratio))

    upscaled = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    upscaled.save(buffer, format=image.format or "PNG")
    return buffer.getvalue()
