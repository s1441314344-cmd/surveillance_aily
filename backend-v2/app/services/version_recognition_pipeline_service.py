import json
import time
from io import BytesIO
from pathlib import Path
from typing import Callable

from PIL import Image
from sqlalchemy.orm import Session

from app.models.file_asset import FileAsset
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.services.ids import generate_id
from app.services.ocr_service import recognize_with_ocr_service
from app.services.version_recognition_extractor import (
    crop_image_by_roi,
    crop_image_for_template,
    extract_version_recognition_result,
    rotate_image_bytes,
)
from app.services.version_recognition_templates import DEFAULT_VERSION_RECOGNITION_TEMPLATE


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
                "attempts": ocr_attempt_payloads,
                "attempt_count": len(ocr_attempt_payloads),
            },
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        ),
        normalized_json=normalized_json,
        result_status="completed",
        duration_ms=duration_ms,
        feedback_status="unreviewed",
    )
    db.add(task_record)
    job.completed_items += 1
    db.commit()
    finish_job(db, job, status="completed", error_message=None)


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
