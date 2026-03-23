from __future__ import annotations

import json

import httpx

from app.core.config import get_settings
from app.services.model_provider_service import load_model_provider_runtime
from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse
from app.services.providers.mock_response import build_mock_provider_response
from app.services.providers.utils import (
    build_schema_instruction,
    encode_image_to_base64,
    ensure_object_json,
    extract_json_payload,
    strip_think_blocks,
)

settings = get_settings()


class ZhipuAdapter(ModelProviderAdapter):
    provider = "zhipu"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        runtime = load_model_provider_runtime(self.provider)
        if runtime is None:
            return self._fallback_or_failure(request, "Zhipu provider is not configured")
        if runtime.status != "active":
            return self._fallback_or_failure(request, "Zhipu provider is inactive")
        if not runtime.api_key:
            return self._fallback_or_failure(request, "Zhipu API key is not configured")

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
                error_message=f"Zhipu request failed: {exc}",
            )
        except ValueError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"Zhipu returned invalid JSON payload: {exc}",
            )

        output_text = _extract_zhipu_message_content(body)
        clean_text = strip_think_blocks(output_text)
        normalized_json = ensure_object_json(extract_json_payload(clean_text))
        if normalized_json is None:
            return ProviderResponse(
                success=False,
                raw_response=output_text or json.dumps(body, ensure_ascii=False),
                normalized_json=None,
                error_message="Zhipu did not return valid JSON content",
            )

        return ProviderResponse(
            success=True,
            raw_response=output_text or json.dumps(normalized_json, ensure_ascii=False),
            normalized_json=normalized_json,
            error_message=None,
            usage=_extract_usage(body),
        )

    def _build_payload(self, request: ProviderRequest, model_name: str) -> dict:
        user_content = [{"type": "text", "text": f"{request.prompt}\n\n{build_schema_instruction(request.response_schema)}"}]
        for image_path in request.image_paths:
            user_content.append({"type": "image_url", "image_url": {"url": encode_image_to_base64(image_path)}})

        return {
            "model": model_name,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个严格的视觉分析助手。除 JSON 外不要输出任何额外文本。",
                },
                {
                    "role": "user",
                    "content": user_content,
                },
            ],
            "temperature": 0.1,
            "stream": False,
        }

    def _fallback_or_failure(self, request: ProviderRequest, reason: str) -> ProviderResponse:
        if settings.provider_mock_fallback_enabled:
            return build_mock_provider_response(self.provider, request)
        return ProviderResponse(success=False, raw_response="", normalized_json=None, error_message=reason)


def _extract_zhipu_message_content(body: dict) -> str:
    choices = body.get("choices") or []
    if not choices:
        return ""

    message = (choices[0] or {}).get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text" and item.get("text"):
                text_parts.append(str(item["text"]))
            elif isinstance(item, dict) and item.get("text"):
                text_parts.append(str(item["text"]))
        return "\n".join(text_parts).strip()
    return str(content).strip() if content is not None else ""


def _extract_usage(body: dict) -> dict | None:
    usage = body.get("usage") or {}
    prompt_tokens = usage.get("prompt_tokens") or usage.get("input_tokens")
    completion_tokens = usage.get("completion_tokens") or usage.get("output_tokens")
    total_tokens = usage.get("total_tokens")
    if prompt_tokens is None and completion_tokens is None and total_tokens is None:
        return None
    return {
        "input_tokens": int(prompt_tokens or 0),
        "output_tokens": int(completion_tokens or 0),
        "total_tokens": int(total_tokens or (int(prompt_tokens or 0) + int(completion_tokens or 0))),
    }
