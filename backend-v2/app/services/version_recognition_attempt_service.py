from dataclasses import dataclass
from io import BytesIO

from PIL import Image

from app.services.ocr_service import recognize_with_ocr_service
from app.services.version_recognition_extractor import (
    crop_image_by_roi,
    crop_image_for_template,
    extract_version_recognition_result,
    rotate_image_bytes,
)
from app.services.version_recognition_templates import DEFAULT_VERSION_RECOGNITION_TEMPLATE


@dataclass
class VersionRecognitionAttemptResult:
    normalized_json: dict
    ocr_attempt_payloads: list[dict]


def run_version_recognition_attempts(*, image_bytes: bytes, original_name: str) -> VersionRecognitionAttemptResult:
    ocr_attempt_payloads: list[dict] = []
    combined_lines: list[dict] = []
    roi_applied = False

    def build_normalized_result() -> dict:
        return extract_version_recognition_result(
            lines=combined_lines,
            template=DEFAULT_VERSION_RECOGNITION_TEMPLATE,
            roi_applied=roi_applied,
            context_hint=original_name,
        )

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
            attempt_filename=f"roi-center-{original_name}",
            required=False,
        ):
            roi_applied = True
    except Exception:
        pass

    if roi_applied:
        normalized_json = build_normalized_result()
        if normalized_json.get("extraction_status") == "matched":
            return VersionRecognitionAttemptResult(
                normalized_json=normalized_json,
                ocr_attempt_payloads=ocr_attempt_payloads,
            )

    for roi_name, roi in DEFAULT_VERSION_RECOGNITION_TEMPLATE.fallback_rois:
        try:
            roi_bytes = crop_image_by_roi(image_bytes=image_bytes, roi=roi)
        except Exception:
            continue
        if run_ocr_attempt(
            scope=f"roi_{roi_name}",
            attempt_bytes=roi_bytes,
            attempt_filename=f"roi-{roi_name}-{original_name}",
            required=False,
        ):
            roi_applied = True
            normalized_json = build_normalized_result()
            if normalized_json.get("extraction_status") == "matched":
                return VersionRecognitionAttemptResult(
                    normalized_json=normalized_json,
                    ocr_attempt_payloads=ocr_attempt_payloads,
                )

    if roi_applied:
        normalized_json = build_normalized_result()
        if normalized_json.get("extraction_status") == "matched":
            return VersionRecognitionAttemptResult(
                normalized_json=normalized_json,
                ocr_attempt_payloads=ocr_attempt_payloads,
            )

    run_ocr_attempt(
        scope="full",
        attempt_bytes=image_bytes,
        attempt_filename=original_name,
        required=True,
    )
    normalized_json = build_normalized_result()
    initial_version = normalized_json.get("recognized_version")

    if normalized_json.get("extraction_status") in {"not_found", "ambiguous"}:
        rotation_matched = False
        for angle in DEFAULT_VERSION_RECOGNITION_TEMPLATE.rotation_angles:
            rotated_bytes = rotate_image_bytes(image_bytes=image_bytes, angle=angle)
            if not run_ocr_attempt(
                scope=f"full_rotated_{angle}",
                attempt_bytes=rotated_bytes,
                attempt_filename=f"rot{angle}-{original_name}",
                required=False,
            ):
                continue
            normalized_json = build_normalized_result()
            if normalized_json.get("extraction_status") == "matched":
                normalized_json["summary"] = f"{normalized_json.get('summary') or '已识别版本号'}（通过旋转回退命中）"
                rotation_matched = True
                break
        if not rotation_matched:
            normalized_json = build_normalized_result()
            if normalized_json.get("extraction_status") == "matched":
                normalized_json["summary"] = f"{normalized_json.get('summary') or '已识别版本号'}（通过旋转回退命中）"

    if normalized_json.get("extraction_status") in {"not_found", "ambiguous"}:
        upscaled_bytes = _upscale_image_bytes(image_bytes=image_bytes, scale=2.0, max_side=4096)
        upscaled_matched = False
        if run_ocr_attempt(
            scope="full_upscaled_x2",
            attempt_bytes=upscaled_bytes,
            attempt_filename=f"upscaled-{original_name}",
            required=False,
        ):
            normalized_json = build_normalized_result()
            if normalized_json.get("extraction_status") == "matched":
                normalized_json["summary"] = f"{normalized_json.get('summary') or '已识别版本号'}（通过放大/旋转回退命中）"
                upscaled_matched = True
        if not upscaled_matched:
            for angle in DEFAULT_VERSION_RECOGNITION_TEMPLATE.rotation_angles:
                upscaled_rotated = rotate_image_bytes(image_bytes=upscaled_bytes, angle=angle)
                if not run_ocr_attempt(
                    scope=f"full_upscaled_x2_rotated_{angle}",
                    attempt_bytes=upscaled_rotated,
                    attempt_filename=f"upscaled-rot{angle}-{original_name}",
                    required=False,
                ):
                    continue
                normalized_json = build_normalized_result()
                if normalized_json.get("extraction_status") == "matched":
                    normalized_json["summary"] = f"{normalized_json.get('summary') or '已识别版本号'}（通过放大/旋转回退命中）"
                    upscaled_matched = True
                    break
        if not upscaled_matched:
            normalized_json = build_normalized_result()
            if normalized_json.get("extraction_status") == "matched":
                normalized_json["summary"] = f"{normalized_json.get('summary') or '已识别版本号'}（通过放大/旋转回退命中）"
            elif normalized_json.get("extraction_status") == "not_found":
                normalized_json["summary"] = "未识别到版本号（已尝试中心ROI、四角ROI、全图、旋转与放大回退）"

    if (
        normalized_json.get("extraction_status") == "matched"
        and initial_version
        and normalized_json.get("recognized_version") != initial_version
    ):
        normalized_json["summary"] = f"已识别版本号：{normalized_json.get('recognized_version')}（通过多路回退校正）"

    return VersionRecognitionAttemptResult(
        normalized_json=normalized_json,
        ocr_attempt_payloads=ocr_attempt_payloads,
    )


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
