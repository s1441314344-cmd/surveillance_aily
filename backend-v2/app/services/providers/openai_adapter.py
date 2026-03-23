from __future__ import annotations

import json

import httpx

from app.core.config import get_settings
from app.services.model_provider_service import load_model_provider_runtime
from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse
from app.services.providers.mock_response import build_mock_provider_response
from app.services.providers.utils import (
    encode_image_to_data_url,
    ensure_object_json,
    extract_json_payload,
    normalize_openai_json_schema,
)

settings = get_settings()


class OpenAIAdapter(ModelProviderAdapter):
    provider = "openai"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        runtime = load_model_provider_runtime(self.provider)
        if runtime is None:
            return self._fallback_or_failure(request, "OpenAI provider is not configured")
        if runtime.status != "active":
            return self._fallback_or_failure(request, "OpenAI provider is inactive")
        if not runtime.api_key:
            return self._fallback_or_failure(request, "OpenAI API key is not configured")

        model_name = request.model or runtime.default_model
        payload = self._build_payload(request, model_name)
        headers = {
            "Authorization": f"Bearer {runtime.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=runtime.timeout_seconds) as client:
                response = client.post(runtime.base_url, headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"OpenAI request failed: {exc}",
            )
        except ValueError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"OpenAI returned invalid JSON payload: {exc}",
            )

        refusal_message = _extract_refusal_message(body)
        if refusal_message:
            return ProviderResponse(
                success=False,
                raw_response=refusal_message,
                normalized_json=None,
                error_message=f"OpenAI refused the request: {refusal_message}",
            )

        output_text = _extract_output_text(body)
        normalized_json = ensure_object_json(extract_json_payload(output_text))
        if normalized_json is None:
            return ProviderResponse(
                success=False,
                raw_response=output_text or json.dumps(body, ensure_ascii=False),
                normalized_json=None,
                error_message="OpenAI did not return valid JSON content",
            )

        return ProviderResponse(
            success=True,
            raw_response=output_text or json.dumps(normalized_json, ensure_ascii=False),
            normalized_json=normalized_json,
            error_message=None,
            usage=_extract_usage(body),
        )

    def _build_payload(self, request: ProviderRequest, model_name: str) -> dict:
        content = [{"type": "input_text", "text": request.prompt}]
        for image_path in request.image_paths:
            content.append({"type": "input_image", "image_url": encode_image_to_data_url(image_path)})

        return {
            "model": model_name,
            "input": [{"role": "user", "content": content}],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "inspection_result",
                    "schema": normalize_openai_json_schema(request.response_schema),
                    "strict": True,
                }
            },
        }

    def _fallback_or_failure(self, request: ProviderRequest, reason: str) -> ProviderResponse:
        if settings.provider_mock_fallback_enabled:
            return build_mock_provider_response(self.provider, request)
        return ProviderResponse(success=False, raw_response="", normalized_json=None, error_message=reason)


def _extract_output_text(body: dict) -> str:
    output_items = body.get("output") or []
    texts: list[str] = []
    for item in output_items:
        if item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            if content.get("type") == "output_text" and content.get("text"):
                texts.append(content["text"])

    if texts:
        return "\n".join(texts).strip()
    return ""


def _extract_refusal_message(body: dict) -> str | None:
    output_items = body.get("output") or []
    for item in output_items:
        if item.get("type") != "message":
            continue
        for content in item.get("content") or []:
            if content.get("type") == "refusal":
                return str(content.get("refusal") or content.get("text") or "").strip() or "Request refused"
    return None


def _extract_usage(body: dict) -> dict | None:
    usage = body.get("usage") or {}
    input_tokens = usage.get("input_tokens") or usage.get("prompt_tokens")
    output_tokens = usage.get("output_tokens") or usage.get("completion_tokens")
    total_tokens = usage.get("total_tokens")
    if input_tokens is None and output_tokens is None and total_tokens is None:
        return None
    return {
        "input_tokens": int(input_tokens or 0),
        "output_tokens": int(output_tokens or 0),
        "total_tokens": int(total_tokens or (int(input_tokens or 0) + int(output_tokens or 0))),
    }
