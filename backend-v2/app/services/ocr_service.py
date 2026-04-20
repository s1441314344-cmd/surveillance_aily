from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.services.version_recognition_templates import VersionRecognitionTemplate

settings = get_settings()


@dataclass
class OcrServiceResult:
    lines: list[dict]
    image_width: int
    image_height: int
    raw_payload: dict


def recognize_with_ocr_service(
    *,
    image_bytes: bytes,
    filename: str,
    template: VersionRecognitionTemplate,
) -> OcrServiceResult:
    endpoint = f"{settings.ocr_service_base_url.rstrip('/')}/v1/ocr/recognize"
    try:
        with httpx.Client(timeout=settings.ocr_service_timeout_seconds) as client:
            response = client.post(
                endpoint,
                data={"template_key": template.key},
                files={"file": (filename or "version-image.jpg", image_bytes, "application/octet-stream")},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise RuntimeError(f"OCR service request failed: {detail}") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError(f"OCR service unavailable: {exc}") from exc

    payload = response.json()
    return OcrServiceResult(
        lines=list(payload.get("lines") or []),
        image_width=int(payload.get("image_width") or 0),
        image_height=int(payload.get("image_height") or 0),
        raw_payload=payload,
    )
