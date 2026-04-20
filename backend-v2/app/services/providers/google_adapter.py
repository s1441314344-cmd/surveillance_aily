from __future__ import annotations

import json
import time

import httpx

from app.core.config import get_settings
from app.services.model_provider_service import load_model_provider_runtime
from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse
from app.services.providers.mock_response import build_mock_provider_response
from app.services.providers.retry_policy import HTTPRetryPolicy, post_json_with_retry
from app.services.providers.utils import (
    build_schema_instruction,
    encode_image_to_base64,
    ensure_object_json,
    extract_json_payload,
)

settings = get_settings()
GOOGLE_RETRY_POLICY = HTTPRetryPolicy(
    max_attempts=8,
    retryable_status_codes=frozenset({429, 500, 502, 503, 504}),
    max_backoff_seconds=120.0,
    max_retry_after_seconds=300.0,
)


class GoogleAdapter(ModelProviderAdapter):
    provider = "google"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        runtime = load_model_provider_runtime(self.provider)
        if runtime is None:
            return self._fallback_or_failure(request, "Google provider is not configured")
        if runtime.status != "active":
            return self._fallback_or_failure(request, "Google provider is inactive")
        if not runtime.api_key:
            return self._fallback_or_failure(request, "Google API key is not configured")

        model_name = request.model or runtime.default_model
        endpoint = self._build_endpoint(runtime.base_url, model_name)
        payload = self._build_payload(request)
        headers = {
            "x-goog-api-key": runtime.api_key,
            "Content-Type": "application/json",
        }

        try:
            body = self._post_with_retry(
                endpoint=endpoint,
                headers=headers,
                payload=payload,
                timeout_seconds=runtime.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"Google request failed: {exc}",
            )
        except ValueError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"Google returned invalid JSON payload: {exc}",
            )

        output_text = _extract_google_message_content(body)
        return _build_provider_response(
            output_text=output_text,
            raw_fallback=json.dumps(body, ensure_ascii=False),
            response_format=request.response_format,
            usage=_extract_usage(body),
        )

    def _post_with_retry(
        self,
        *,
        endpoint: str,
        headers: dict,
        payload: dict,
        timeout_seconds: int,
    ) -> dict:
        return post_json_with_retry(
            endpoint=endpoint,
            headers=headers,
            payload=payload,
            timeout_seconds=timeout_seconds,
            retry_policy=GOOGLE_RETRY_POLICY,
            client_factory=httpx.Client,
            sleep_func=time.sleep,
        )

    def _build_endpoint(self, base_url: str, model_name: str) -> str:
        normalized = base_url.rstrip("/")
        if normalized.endswith(":generateContent"):
            return normalized
        if normalized.endswith("/models"):
            return f"{normalized}/{model_name}:generateContent"
        if f"/models/{model_name}" in normalized:
            suffix = ":generateContent"
            return normalized if normalized.endswith(suffix) else f"{normalized}{suffix}"
        return f"{normalized}/{model_name}:generateContent"

    def _build_payload(self, request: ProviderRequest) -> dict:
        response_format = (request.response_format or "json_schema").strip().lower()
        prompt = request.prompt
        if response_format == "json_schema":
            prompt = f"{prompt}\n\n{build_schema_instruction(request.response_schema)}"
        elif response_format == "json_object":
            prompt = f"{prompt}\n\n请只返回一个合法 JSON 对象，不要输出额外解释。"
        elif response_format == "auto":
            prompt = f"{prompt}\n\n优先返回一个合法 JSON 对象；如果无法结构化，请返回简洁文本结论。"

        parts: list[dict] = [{"text": prompt}]
        for image_path in request.image_paths:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": _guess_mime_type(image_path),
                        "data": encode_image_to_base64(image_path),
                    }
                }
            )

        generation_config = {"temperature": 0.1}
        if response_format in {"json_schema", "json_object"}:
            generation_config["responseMimeType"] = "application/json"
        elif response_format == "text":
            generation_config["responseMimeType"] = "text/plain"

        return {
            "contents": [
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
            "generationConfig": generation_config,
        }

    def _fallback_or_failure(self, request: ProviderRequest, reason: str) -> ProviderResponse:
        if settings.provider_mock_fallback_enabled:
            return build_mock_provider_response(self.provider, request)
        return ProviderResponse(success=False, raw_response="", normalized_json=None, error_message=reason)


def _extract_google_message_content(body: dict) -> str:
    candidates = body.get("candidates") or []
    if not candidates:
        return ""

    content = (candidates[0] or {}).get("content") or {}
    parts = content.get("parts") or []
    texts: list[str] = []
    for item in parts:
        if isinstance(item, dict) and item.get("text"):
            texts.append(str(item["text"]))
    return "\n".join(texts).strip()


def _extract_usage(body: dict) -> dict | None:
    usage = body.get("usageMetadata") or {}
    input_tokens = usage.get("promptTokenCount")
    output_tokens = usage.get("candidatesTokenCount")
    total_tokens = usage.get("totalTokenCount")
    if input_tokens is None and output_tokens is None and total_tokens is None:
        return None
    return {
        "input_tokens": int(input_tokens or 0),
        "output_tokens": int(output_tokens or 0),
        "total_tokens": int(total_tokens or (int(input_tokens or 0) + int(output_tokens or 0))),
    }


def _build_provider_response(
    *,
    output_text: str,
    raw_fallback: str,
    response_format: str,
    usage: dict | None,
) -> ProviderResponse:
    normalized_format = (response_format or "json_schema").strip().lower()
    raw_response = output_text or raw_fallback

    if normalized_format == "text":
        text_content = output_text.strip() if output_text else raw_fallback
        return ProviderResponse(
            success=bool(text_content),
            raw_response=text_content,
            normalized_json={"raw_text": text_content} if text_content else None,
            error_message=None if text_content else "Google did not return text content",
            usage=usage,
        )

    normalized_json = ensure_object_json(extract_json_payload(output_text))
    if normalized_json is not None:
        return ProviderResponse(
            success=True,
            raw_response=raw_response,
            normalized_json=normalized_json,
            error_message=None,
            usage=usage,
        )

    if normalized_format == "auto":
        fallback_text = output_text.strip() if output_text else ""
        if fallback_text:
            return ProviderResponse(
                success=True,
                raw_response=fallback_text,
                normalized_json={"raw_text": fallback_text},
                error_message=None,
                usage=usage,
            )

    return ProviderResponse(
        success=False,
        raw_response=raw_response,
        normalized_json=None,
        error_message="Google did not return valid JSON content",
        usage=usage,
    )


def _guess_mime_type(image_path: str) -> str:
    normalized = image_path.lower()
    if normalized.endswith(".png"):
        return "image/png"
    if normalized.endswith(".webp"):
        return "image/webp"
    if normalized.endswith(".bmp"):
        return "image/bmp"
    return "image/jpeg"
