from __future__ import annotations

import json
import time

import httpx

from app.core.config import get_settings
from app.services.model_provider_service import load_model_provider_runtime
from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse
from app.services.providers.mock_response import build_mock_provider_response
from app.services.providers.retry_policy import HTTPRetryPolicy
from app.services.providers.utils import (
    build_schema_instruction,
    encode_image_to_data_url,
    ensure_object_json,
    extract_json_payload,
    normalize_openai_json_schema,
)

settings = get_settings()
OPENAI_RETRY_POLICY = HTTPRetryPolicy(
    max_attempts=8,
    retryable_status_codes=frozenset({429, 500, 502, 503, 504}),
    max_backoff_seconds=120.0,
    max_retry_after_seconds=300.0,
)


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
        endpoint = self._build_endpoint(runtime.base_url)
        headers = {
            "Authorization": f"Bearer {runtime.api_key}",
            "Content-Type": "application/json",
        }

        body: dict
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
        return _build_provider_response(
            output_text=output_text,
            raw_fallback=json.dumps(body, ensure_ascii=False),
            response_format=request.response_format,
            usage=_extract_usage(body),
        )

    def _build_payload(self, request: ProviderRequest, model_name: str) -> dict:
        response_format = (request.response_format or "json_schema").strip().lower()
        prompt = request.prompt
        if response_format == "json_schema":
            prompt = f"{prompt}\n\n{build_schema_instruction(request.response_schema)}"
        elif response_format == "json_object":
            prompt = f"{prompt}\n\n请只返回一个合法 JSON 对象，不要输出额外解释。"
        elif response_format == "auto":
            prompt = f"{prompt}\n\n优先返回一个合法 JSON 对象；如果无法结构化，请返回简洁文本结论。"

        content = [{"type": "input_text", "text": prompt}]
        for image_path in request.image_paths:
            content.append({"type": "input_image", "image_url": encode_image_to_data_url(image_path)})

        payload = {
            "model": model_name,
            "input": [{"role": "user", "content": content}],
        }
        if response_format == "json_schema":
            payload["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "inspection_result",
                    "schema": normalize_openai_json_schema(request.response_schema),
                    "strict": True,
                }
            }
        return payload

    def _post_with_retry(
        self,
        *,
        endpoint: str,
        headers: dict,
        payload: dict,
        timeout_seconds: int,
    ) -> dict:
        last_exc: httpx.HTTPError | None = None

        with httpx.Client(timeout=timeout_seconds) as client:
            for attempt in range(1, OPENAI_RETRY_POLICY.max_attempts + 1):
                try:
                    response = client.post(endpoint, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPStatusError as exc:
                    if not OPENAI_RETRY_POLICY.should_retry(exc, attempt=attempt):
                        raise
                    last_exc = exc
                    time.sleep(OPENAI_RETRY_POLICY.delay_seconds(exc, attempt=attempt))
                except httpx.HTTPError as exc:
                    if not OPENAI_RETRY_POLICY.should_retry(exc, attempt=attempt):
                        raise
                    last_exc = exc
                    time.sleep(OPENAI_RETRY_POLICY.delay_seconds(exc, attempt=attempt))

        if last_exc is not None:
            raise last_exc
        raise RuntimeError("OpenAI request failed without an exception")

    def _build_endpoint(self, base_url: str) -> str:
        normalized = (base_url or "").rstrip("/")
        if normalized.endswith("/responses"):
            return normalized
        if normalized.endswith("/v1"):
            return f"{normalized}/responses"
        if normalized.endswith("/v1/"):
            return f"{normalized.rstrip('/')}/responses"
        if normalized.endswith("/responses/"):
            return normalized.rstrip("/")
        return f"{normalized}/responses"

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
            error_message=None if text_content else "OpenAI did not return text content",
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
        error_message="OpenAI did not return valid JSON content",
        usage=usage,
    )
