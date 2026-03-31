import json
from pathlib import Path

from app.services.providers.base import ProviderRequest, ProviderResponse


def build_mock_provider_response(provider: str, request: ProviderRequest) -> ProviderResponse:
    image_name = Path(request.image_paths[0]).name if request.image_paths else "image"
    response_format = (request.response_format or "json_schema").strip().lower()

    if response_format == "text":
        raw_text = f"Mock analysis for {image_name} by {provider}/{request.model}"
        return ProviderResponse(
            success=True,
            raw_response=raw_text,
            normalized_json={"raw_text": raw_text},
            error_message=None,
            usage={
                "input_tokens": _estimate_tokens(request.prompt),
                "output_tokens": _estimate_tokens(raw_text),
                "total_tokens": _estimate_tokens(request.prompt) + _estimate_tokens(raw_text),
            },
        )

    normalized_json = _generate_value(
        request.response_schema or {"type": "object"},
        field_name="root",
        provider=provider,
        model=request.model,
        image_name=image_name,
    )
    raw_response = json.dumps(normalized_json, ensure_ascii=False, indent=2)
    prompt_tokens = _estimate_tokens(request.prompt)
    completion_tokens = _estimate_tokens(raw_response)
    return ProviderResponse(
        success=True,
        raw_response=raw_response,
        normalized_json=normalized_json if isinstance(normalized_json, dict) else {"result": normalized_json},
        error_message=None,
        usage={
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    )


def _generate_value(
    schema: dict,
    *,
    field_name: str,
    provider: str,
    model: str,
    image_name: str,
    depth: int = 0,
):
    if depth > 4:
        return None

    schema_type = schema.get("type", "string")
    if isinstance(schema_type, list):
        schema_type = next((item for item in schema_type if item != "null"), schema_type[0] if schema_type else "string")

    if schema_type == "object":
        properties = schema.get("properties", {})
        required = schema.get("required", list(properties.keys()))
        keys = list(dict.fromkeys(list(properties.keys()) + list(required)))
        return {
            key: _generate_value(
                properties.get(key, {"type": "string"}),
                field_name=key,
                provider=provider,
                model=model,
                image_name=image_name,
                depth=depth + 1,
            )
            for key in keys
        }

    if schema_type == "array":
        items = schema.get("items", {"type": "string"})
        return [
            _generate_value(
                items,
                field_name=field_name,
                provider=provider,
                model=model,
                image_name=image_name,
                depth=depth + 1,
            )
        ]

    if schema_type == "boolean":
        lowered = field_name.lower()
        if lowered.startswith("is_"):
            return True
        if lowered.startswith("has_"):
            return False
        return True

    if schema_type == "integer":
        return 1

    if schema_type == "number":
        return 0.98

    if schema_type == "null":
        return None

    lowered = field_name.lower()
    if "summary" in lowered:
        return f"Mock analysis for {image_name} by {provider}/{model}"
    if "recognized_text" in lowered:
        return "2026-03-22"
    if "risk" in lowered:
        return "low"
    if "target" in lowered:
        return image_name
    return f"mock_{field_name}"


def _estimate_tokens(text: str) -> int:
    return max(1, (len(text or "") + 3) // 4)
