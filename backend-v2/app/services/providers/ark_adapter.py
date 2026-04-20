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
    encode_image_to_data_url,
    ensure_object_json,
    extract_json_payload,
)

settings = get_settings()
ARK_RETRY_POLICY = HTTPRetryPolicy(
    max_attempts=8,
    retryable_status_codes=frozenset({429, 500, 502, 503, 504}),
    max_backoff_seconds=120.0,
    max_retry_after_seconds=300.0,
)


class ArkAdapter(ModelProviderAdapter):
    provider = "ark"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        runtime = load_model_provider_runtime(self.provider)
        if runtime is None:
            return self._fallback_or_failure(request, "Ark provider is not configured")
        if runtime.status != "active":
            return self._fallback_or_failure(request, "Ark provider is inactive")
        if not runtime.api_key:
            return self._fallback_or_failure(request, "Ark API key is not configured")

        model_name = request.model or runtime.default_model
        payload = self._build_payload(request, model_name)
        headers = {
            "Authorization": f"Bearer {runtime.api_key}",
            "Content-Type": "application/json",
        }

        try:
            body = self._post_with_retry(
                endpoint=runtime.base_url,
                headers=headers,
                payload=payload,
                timeout_seconds=runtime.timeout_seconds,
            )
        except httpx.HTTPStatusError as exc:
            return ProviderResponse(
                success=False,
                raw_response=(exc.response.text if exc.response is not None else "")[:2000],
                normalized_json=None,
                error_message=_format_http_error_message(exc, request=request, model_name=model_name),
            )
        except httpx.HTTPError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"Ark request failed: {exc}",
            )
        except ValueError as exc:
            return ProviderResponse(
                success=False,
                raw_response="",
                normalized_json=None,
                error_message=f"Ark returned invalid JSON payload: {exc}",
            )

        output_text = _extract_ark_message_content(body)
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
            retry_policy=ARK_RETRY_POLICY,
            client_factory=httpx.Client,
            sleep_func=time.sleep,
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

        content = [{"type": "text", "text": prompt}]
        for image_path in request.image_paths:
            content.append({"type": "image_url", "image_url": {"url": encode_image_to_data_url(image_path)}})

        return {
            "model": model_name,
            "messages": [
                {
                    "role": "system",
                    "content": "你是视觉巡检分析助手。按照用户要求输出。",
                },
                {
                    "role": "user",
                    "content": content,
                },
            ],
            "temperature": 0.1,
            "stream": False,
        }

    def _fallback_or_failure(self, request: ProviderRequest, reason: str) -> ProviderResponse:
        if settings.provider_mock_fallback_enabled:
            return build_mock_provider_response(self.provider, request)
        return ProviderResponse(success=False, raw_response="", normalized_json=None, error_message=reason)


def _extract_ark_message_content(body: dict) -> str:
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
            error_message=None if text_content else "Ark did not return text content",
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
        error_message="Ark did not return valid JSON content",
        usage=usage,
    )


def _format_http_error_message(
    exc: httpx.HTTPStatusError,
    *,
    request: ProviderRequest,
    model_name: str,
) -> str:
    response = exc.response
    status_code = response.status_code if response is not None else "unknown"
    detail = _extract_http_error_detail(response)
    hints = _build_ark_http_error_hints(
        status_code=int(status_code) if isinstance(status_code, int) else None,
        request=request,
        model_name=model_name,
    )
    message = f"Ark request failed: HTTP {status_code}"
    if detail:
        message = f"{message} - {detail}"
    if hints:
        message = f"{message} | 排查建议：{'；'.join(hints)}"
    return message


def _extract_http_error_detail(response: httpx.Response | None) -> str | None:
    if response is None:
        return None
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message") or error.get("msg")
            if isinstance(message, str) and message.strip():
                return message.strip()
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()

    text = (response.text or "").strip()
    if text:
        return text[:300]
    return None


def _build_ark_http_error_hints(
    *,
    status_code: int | None,
    request: ProviderRequest,
    model_name: str,
) -> list[str]:
    hints: list[str] = []
    if status_code != 400:
        return hints
    if request.image_paths:
        hints.append("当前请求包含图片，请确认所选模型支持视觉输入，或先在调试中关闭示例图片")
    if model_name and not model_name.strip().lower().startswith("ep-"):
        hints.append("火山方舟通常要求使用 endpoint id 作为 model（例如 ep-2026xxxx）")
    if not hints:
        hints.append("请检查 base_url、API Key 和模型名称是否与方舟控制台保持一致")
    return hints
