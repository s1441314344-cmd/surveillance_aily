from __future__ import annotations

from io import BytesIO
import re
import shutil
import subprocess
from typing import Any

from app.services.camera_capture_service import CameraFrame


class CameraRoiError(RuntimeError):
    pass


def extract_analysis_roi(config: Any) -> dict[str, Any] | None:
    if config is None:
        return None
    roi_enabled = _read_attr(config, "roi_enabled")
    if not bool(roi_enabled):
        return None
    roi = _normalize_any_roi(
        {
            "x": _read_attr(config, "roi_x"),
            "y": _read_attr(config, "roi_y"),
            "width": _read_attr(config, "roi_width"),
            "height": _read_attr(config, "roi_height"),
            "shape": _read_attr(config, "roi_shape"),
            "points": _read_attr(config, "roi_points"),
        }
    )
    return roi


def normalize_analysis_roi(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    return _normalize_any_roi(raw)


def apply_analysis_roi_to_frame(
    frame: CameraFrame,
    analysis_roi: dict[str, Any] | None,
) -> tuple[CameraFrame, dict[str, Any] | None]:
    normalized = _normalize_any_roi(analysis_roi)
    if normalized is None:
        return frame, None
    roi_shape = str(normalized.get("shape") or "rect").lower()
    if roi_shape == "polygon":
        return _apply_polygon_roi(frame, normalized), normalized
    return _apply_rect_roi(frame, normalized), normalized


def _apply_rect_roi(frame: CameraFrame, normalized: dict[str, Any]) -> CameraFrame:
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path is None:
        raise CameraRoiError("ffmpeg is required for ROI cropping")

    x = float(normalized["x"])
    y = float(normalized["y"])
    width = float(normalized["width"])
    height = float(normalized["height"])
    crop_filter = (
        "crop="
        f"iw*{width:.6f}:"
        f"ih*{height:.6f}:"
        f"iw*{x:.6f}:"
        f"ih*{y:.6f}"
    )
    command = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        "pipe:0",
        "-vf",
        crop_filter,
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "pipe:1",
    ]
    try:
        result = subprocess.run(
            command,
            input=frame.content,
            capture_output=True,
            timeout=12,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise CameraRoiError("ROI crop timed out") from exc

    if result.returncode != 0 or not result.stdout:
        stderr = (result.stderr.decode(errors="ignore") if result.stderr else "").strip()
        if len(stderr) > 240:
            stderr = stderr[-240:]
        raise CameraRoiError(f"ROI crop failed: {stderr or 'unknown ffmpeg error'}")

    return CameraFrame(
        content=result.stdout,
        original_name=_append_roi_suffix(frame.original_name),
        mime_type="image/jpeg",
    )


def _apply_polygon_roi(frame: CameraFrame, normalized: dict[str, Any]) -> CameraFrame:
    try:
        from PIL import Image, ImageDraw
    except Exception as exc:  # pragma: no cover - dependency/runtime guard
        raise CameraRoiError(f"Pillow is required for polygon ROI cropping: {exc}") from exc

    points = normalized.get("points")
    if not isinstance(points, list) or len(points) < 3:
        raise CameraRoiError("Polygon ROI points are invalid")

    try:
        source = Image.open(BytesIO(frame.content)).convert("RGB")
    except Exception as exc:
        raise CameraRoiError(f"Failed to decode source image for polygon ROI: {exc}") from exc

    image_width, image_height = source.size
    if image_width <= 1 or image_height <= 1:
        raise CameraRoiError("Source image is too small for polygon ROI")

    abs_points: list[tuple[int, int]] = []
    for point in points:
        x = int(round(float(point["x"]) * (image_width - 1)))
        y = int(round(float(point["y"]) * (image_height - 1)))
        abs_points.append((x, y))

    min_x = max(min(x for x, _ in abs_points), 0)
    min_y = max(min(y for _, y in abs_points), 0)
    max_x = min(max(x for x, _ in abs_points), image_width - 1)
    max_y = min(max(y for _, y in abs_points), image_height - 1)
    if max_x <= min_x or max_y <= min_y:
        raise CameraRoiError("Polygon ROI bounds are invalid")

    crop_box = (min_x, min_y, max_x + 1, max_y + 1)
    cropped = source.crop(crop_box)
    mask = Image.new("L", cropped.size, color=0)
    shifted_points = [(x - min_x, y - min_y) for x, y in abs_points]
    draw = ImageDraw.Draw(mask)
    draw.polygon(shifted_points, fill=255)

    output = Image.new("RGB", cropped.size, color=(0, 0, 0))
    output.paste(cropped, mask=mask)
    buffer = BytesIO()
    output.save(buffer, format="JPEG", quality=90)
    return CameraFrame(
        content=buffer.getvalue(),
        original_name=_append_roi_suffix(frame.original_name),
        mime_type="image/jpeg",
    )


def _normalize_any_roi(raw: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    shape = str(raw.get("shape") or "rect").strip().lower()
    if shape == "polygon":
        polygon = _normalize_polygon_roi(raw)
        if polygon is not None:
            return polygon
    return _normalize_rect_roi(raw)


def _normalize_rect_roi(raw: dict[str, Any]) -> dict[str, Any] | None:
    try:
        x = float(raw.get("x"))
        y = float(raw.get("y"))
        width = float(raw.get("width"))
        height = float(raw.get("height"))
    except (TypeError, ValueError):
        return None

    x = max(0.0, min(1.0, x))
    y = max(0.0, min(1.0, y))
    width = max(0.01, min(1.0, width))
    height = max(0.01, min(1.0, height))

    if x >= 1.0 or y >= 1.0:
        return None
    if x + width > 1.0:
        width = max(0.01, 1.0 - x)
    if y + height > 1.0:
        height = max(0.01, 1.0 - y)

    return {
        "shape": "rect",
        "x": round(x, 6),
        "y": round(y, 6),
        "width": round(width, 6),
        "height": round(height, 6),
    }


def _normalize_polygon_roi(raw: dict[str, Any]) -> dict[str, Any] | None:
    raw_points = raw.get("points")
    if not isinstance(raw_points, list):
        return None

    normalized_points: list[dict[str, float]] = []
    for item in raw_points:
        if isinstance(item, dict):
            x_raw = item.get("x")
            y_raw = item.get("y")
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            x_raw = item[0]
            y_raw = item[1]
        else:
            continue
        try:
            x = clamp01(float(x_raw))
            y = clamp01(float(y_raw))
        except (TypeError, ValueError):
            continue
        normalized_points.append({"x": round(x, 6), "y": round(y, 6)})

    if len(normalized_points) < 3:
        return None

    xs = [point["x"] for point in normalized_points]
    ys = [point["y"] for point in normalized_points]
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)
    width = max_x - min_x
    height = max_y - min_y
    if width < 0.01 or height < 0.01:
        return None

    return {
        "shape": "polygon",
        "x": round(min_x, 6),
        "y": round(min_y, 6),
        "width": round(width, 6),
        "height": round(height, 6),
        "points": normalized_points,
    }


def _read_attr(config: Any, name: str) -> Any:
    if isinstance(config, dict):
        return config.get(name)
    return getattr(config, name, None)


def _append_roi_suffix(filename: str) -> str:
    text = (filename or "camera-frame.jpg").strip()
    if "." in text:
        stem, _dot, _ext = text.rpartition(".")
        normalized_stem = re.sub(r"[^\w.-]+", "-", stem).strip("-") or "camera-frame"
        return f"{normalized_stem}-roi.jpg"
    normalized = re.sub(r"[^\w.-]+", "-", text).strip("-") or "camera-frame"
    return f"{normalized}-roi.jpg"


def clamp01(value: float) -> float:
    if value < 0:
        return 0.0
    if value > 1:
        return 1.0
    return float(value)
