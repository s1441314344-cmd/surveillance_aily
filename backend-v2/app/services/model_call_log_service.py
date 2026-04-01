import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.model_call_log import ModelCallLog
from app.schemas.model_provider import ModelCallLogRead
from app.services.ids import generate_id


def create_model_call_log(
    db: Session,
    *,
    provider: str,
    model_name: str,
    trigger_type: str,
    trigger_source: str | None = None,
    response_format: str | None = None,
    success: bool,
    error_message: str | None = None,
    usage: dict | None = None,
    input_image_count: int = 0,
    job_id: str | None = None,
    schedule_id: str | None = None,
    camera_id: str | None = None,
    strategy_id: str | None = None,
    details: dict | None = None,
) -> ModelCallLog:
    log = ModelCallLog(
        id=generate_id(),
        provider=(provider or "").strip().lower(),
        model_name=(model_name or "").strip(),
        trigger_type=(trigger_type or "").strip(),
        trigger_source=(trigger_source or "").strip() or None,
        response_format=(response_format or "").strip() or None,
        success=bool(success),
        error_message=(error_message or "").strip() or None,
        usage=usage if isinstance(usage, dict) else None,
        input_image_count=max(int(input_image_count or 0), 0),
        job_id=job_id,
        schedule_id=schedule_id,
        camera_id=camera_id,
        strategy_id=strategy_id,
        details=details if isinstance(details, dict) else None,
    )
    db.add(log)
    return log


def build_model_call_details(
    *,
    prompt: str | None = None,
    response_format: str | None = None,
    image_paths: list[str] | None = None,
    input_summary: dict[str, Any] | None = None,
    raw_response: str | None = None,
    normalized_json: dict | None = None,
    error_message: str | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    input_payload: dict[str, Any] = {}
    output_payload: dict[str, Any] = {}

    if prompt:
        input_payload["prompt_preview"] = _truncate_text(prompt, 500)
    if response_format:
        input_payload["response_format"] = response_format
    if image_paths:
        input_payload["image_count"] = len(image_paths)
        input_payload["image_names"] = [Path(item).name for item in image_paths[:5]]
    if input_summary:
        input_payload["summary"] = input_summary

    if raw_response:
        output_payload["raw_preview"] = _truncate_text(raw_response, 1200)
    if normalized_json is not None:
        output_payload["normalized_preview"] = _truncate_json(normalized_json, 1200)
    if error_message:
        output_payload["error"] = _truncate_text(error_message, 600)

    details: dict[str, Any] = {
        "input": input_payload or None,
        "output": output_payload or None,
        "context": context or None,
    }
    return {key: value for key, value in details.items() if value is not None}


def list_model_call_logs(
    db: Session,
    *,
    provider: str | None = None,
    trigger_type: str | None = None,
    success: bool | None = None,
    limit: int = 100,
) -> list[ModelCallLogRead]:
    safe_limit = min(max(int(limit or 100), 1), 500)
    stmt = select(ModelCallLog).order_by(ModelCallLog.created_at.desc(), ModelCallLog.id.desc()).limit(safe_limit)
    if provider:
        stmt = stmt.where(ModelCallLog.provider == provider.strip().lower())
    if trigger_type:
        stmt = stmt.where(ModelCallLog.trigger_type == trigger_type.strip())
    if success is not None:
        stmt = stmt.where(ModelCallLog.success == success)
    return [serialize_model_call_log(item) for item in db.scalars(stmt)]


def serialize_model_call_log(log: ModelCallLog) -> ModelCallLogRead:
    return ModelCallLogRead(
        id=log.id,
        provider=log.provider,
        model_name=log.model_name,
        trigger_type=log.trigger_type,
        trigger_source=log.trigger_source,
        response_format=log.response_format,
        success=log.success,
        error_message=log.error_message,
        usage=log.usage,
        input_image_count=log.input_image_count,
        job_id=log.job_id,
        schedule_id=log.schedule_id,
        camera_id=log.camera_id,
        strategy_id=log.strategy_id,
        details=log.details,
        created_at=_serialize_datetime(log.created_at),
    )


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.astimezone(timezone.utc).isoformat()


def _truncate_text(value: str, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def _truncate_json(payload: Any, limit: int) -> str:
    try:
        serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        serialized = str(payload)
    if len(serialized) <= limit:
        return serialized
    return f"{serialized[:limit]}..."
