from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.camera import Camera
from app.services.camera_capture_service import CameraCaptureConfig, CameraCaptureError, CameraFrame, capture_camera_frame
from app.services.camera_roi_service import CameraRoiError, apply_analysis_roi_to_frame

settings = get_settings()

DEFAULT_SIGNAL_THRESHOLD = 0.5


class LocalDetectorError(RuntimeError):
    pass


@dataclass
class LocalDetectorResult:
    passed: bool
    reason: str
    signals: dict[str, float]
    response_payload: dict[str, Any] | None = None


def detect_with_local_detector(
    *,
    camera: Camera | CameraCaptureConfig,
    expected_signal_keys: set[str],
    person_threshold: float | None = None,
    frame: CameraFrame | None = None,
    analysis_roi: dict | None = None,
) -> LocalDetectorResult:
    if not expected_signal_keys:
        return LocalDetectorResult(
            passed=True,
            reason="no expected signal keys",
            signals={},
            response_payload=None,
        )

    if not settings.local_detector_enabled:
        return LocalDetectorResult(
            passed=True,
            reason="local detector disabled",
            signals={},
            response_payload=None,
        )

    frame_payload = frame
    if frame_payload is None:
        try:
            frame_payload = capture_camera_frame(camera)
        except CameraCaptureError as exc:
            raise LocalDetectorError(f"local detector capture failed: {exc}") from exc
    try:
        frame_payload, _ = apply_analysis_roi_to_frame(frame_payload, analysis_roi)
    except CameraRoiError as exc:
        raise LocalDetectorError(f"local detector ROI crop failed: {exc}") from exc

    threshold = _normalize_threshold(
        person_threshold if person_threshold is not None else settings.local_detector_person_threshold
    )
    body = _invoke_local_detector(frame=frame_payload, person_threshold=threshold)
    signals = _extract_signals(body)

    blocked_reasons: list[str] = []
    for signal_key in sorted(expected_signal_keys):
        confidence = signals.get(signal_key)
        signal_threshold = threshold if signal_key == "person" else DEFAULT_SIGNAL_THRESHOLD
        if confidence is None:
            if signal_key == "person":
                blocked_reasons.append(f"{signal_key}=missing")
            continue
        if confidence < signal_threshold:
            blocked_reasons.append(f"{signal_key}<{signal_threshold:.2f}")

    if blocked_reasons:
        return LocalDetectorResult(
            passed=False,
            reason="local detector gate blocked: " + ", ".join(blocked_reasons),
            signals=signals,
            response_payload=body,
        )

    return LocalDetectorResult(
        passed=True,
        reason="local detector gate passed",
        signals=signals,
        response_payload=body,
    )


def _invoke_local_detector(*, frame: CameraFrame, person_threshold: float) -> dict[str, Any]:
    base_url = (settings.local_detector_base_url or "").strip().rstrip("/")
    if not base_url:
        raise LocalDetectorError("LOCAL_DETECTOR_BASE_URL is empty")

    try:
        with httpx.Client(timeout=settings.local_detector_timeout_seconds) as client:
            response = client.post(
                f"{base_url}/v1/detect",
                files={
                    "file": (frame.original_name, frame.content, frame.mime_type),
                },
                data={
                    "person_threshold": str(person_threshold),
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raw = (exc.response.text if exc.response is not None else "")[:300]
        raise LocalDetectorError(f"local detector HTTP {exc.response.status_code}: {raw}") from exc
    except httpx.HTTPError as exc:
        raise LocalDetectorError(f"local detector request failed: {exc}") from exc
    except ValueError as exc:
        raise LocalDetectorError(f"local detector returned invalid JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise LocalDetectorError("local detector response is not an object")
    return payload


def _extract_signals(payload: dict[str, Any]) -> dict[str, float]:
    raw_signals = payload.get("signals")
    if not isinstance(raw_signals, dict):
        return {}
    normalized: dict[str, float] = {}
    for key, value in raw_signals.items():
        signal_key = str(key or "").strip().lower()
        if not signal_key:
            continue
        try:
            normalized[signal_key] = float(value)
        except (TypeError, ValueError):
            continue
    return normalized


def _normalize_threshold(value: float) -> float:
    threshold = float(value)
    if threshold < 0:
        return 0.0
    if threshold > 1:
        return 1.0
    return threshold
