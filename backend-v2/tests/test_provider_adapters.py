import json
import httpx
import pytest
from datetime import datetime, timezone

from app.services.model_provider_service import ModelProviderRuntimeConfig
from app.services.providers.base import ProviderRequest
from app.services.providers.ark_adapter import ArkAdapter
from app.services.providers.factory import get_provider_adapter
from app.services.providers.google_adapter import GoogleAdapter
from app.services.providers.openai_adapter import OpenAIAdapter
from app.services.providers.zhipu_adapter import ZhipuAdapter


def test_openai_adapter_falls_back_to_mock_without_api_key(monkeypatch, tmp_path):
    image_path = tmp_path / "helmet.jpg"
    image_path.write_bytes(b"fake-image")

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1/responses",
            api_key=None,
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请识别安全帽佩戴情况",
            image_paths=[str(image_path)],
            response_schema={"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
        )
    )

    assert response.success is True
    assert response.normalized_json is not None
    assert "summary" in response.normalized_json


def test_openai_adapter_calls_responses_api_and_parses_structured_json(monkeypatch, tmp_path):
    image_path = tmp_path / "helmet.jpg"
    image_path.write_bytes(b"fake-image")
    captured = {}

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1/responses",
            api_key="sk-test",
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps({"summary": "识别完成", "has_violation": False}, ensure_ascii=False),
                            }
                        ],
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            captured["timeout"] = kwargs.get("timeout")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.openai_adapter.httpx.Client", FakeClient)

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请识别安全帽佩戴情况",
            image_paths=[str(image_path)],
            response_schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "has_violation": {"type": "boolean"},
                },
                "required": ["summary", "has_violation"],
            },
        )
    )

    assert response.success is True
    assert response.normalized_json == {"summary": "识别完成", "has_violation": False}
    assert captured["url"] == "https://api.openai.com/v1/responses"
    assert captured["headers"]["Authorization"] == "Bearer sk-test"
    assert captured["json"]["text"]["format"]["type"] == "json_schema"
    assert captured["json"]["input"][0]["content"][1]["type"] == "input_image"
    assert captured["json"]["input"][0]["content"][1]["image_url"].startswith("data:image/jpeg;base64,")


def test_openai_adapter_accepts_v1_base_url_and_appends_responses(monkeypatch, tmp_path):
    image_path = tmp_path / "openai.jpg"
    image_path.write_bytes(b"fake-image")
    captured = {}

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1",
            api_key="sk-test",
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": "OpenAI 接口地址已自动修正。",
                            }
                        ],
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"] = url
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.openai_adapter.httpx.Client", FakeClient)

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请输出一句结论",
            image_paths=[str(image_path)],
            response_format="text",
            response_schema={},
        )
    )

    assert response.success is True
    assert captured["url"] == "https://api.openai.com/v1/responses"


def test_openai_adapter_retries_429_then_succeeds(monkeypatch, tmp_path):
    image_path = tmp_path / "retry.jpg"
    image_path.write_bytes(b"fake-image")
    state = {"count": 0}

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1/responses",
            api_key="sk-test",
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        status_code = 200
        headers = {}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": json.dumps({"summary": "ok"}, ensure_ascii=False)}],
                    }
                ]
            }

    class Retryable429Response:
        status_code = 429
        headers = {"retry-after": "0"}

        def raise_for_status(self):
            request = httpx.Request("POST", "https://api.openai.com/v1/responses")
            raise httpx.HTTPStatusError("Too Many Requests", request=request, response=self)

        def json(self):
            return {}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            state["count"] += 1
            if state["count"] < 3:
                return Retryable429Response()
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.openai_adapter.httpx.Client", FakeClient)
    monkeypatch.setattr("app.services.providers.openai_adapter.time.sleep", lambda *_args, **_kwargs: None)

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请返回 JSON",
            image_paths=[str(image_path)],
            response_schema={"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
        )
    )

    assert state["count"] == 3
    assert response.success is True
    assert response.normalized_json == {"summary": "ok"}


def test_openai_adapter_respects_http_date_retry_after(monkeypatch, tmp_path):
    image_path = tmp_path / "retry-date.jpg"
    image_path.write_bytes(b"fake-image")
    sleep_calls: list[float] = []

    retry_after_datetime = datetime(2030, 1, 1, 0, 0, 10, tzinfo=timezone.utc)
    fixed_now = datetime(2030, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    class DummyDateTime:
        @classmethod
        def now(cls, tz=None):
            return fixed_now

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1/responses",
            api_key="sk-test",
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        status_code = 200
        headers = {}

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": json.dumps({"summary": "ok"}, ensure_ascii=False)}
                        ],
                    }
                ]
            }

    class RetryableDateResponse:
        status_code = 429
        headers = {"retry-after": "Thu, 01 Jan 2030 00:00:10 GMT"}

        def raise_for_status(self):
            request = httpx.Request("POST", "https://api.openai.com/v1/responses")
            raise httpx.HTTPStatusError("Too Many Requests", request=request, response=self)

        def json(self):
            return {}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            state = getattr(self, "state", {"count": 0})
            state["count"] += 1
            self.state = state
            if state["count"] == 1:
                return RetryableDateResponse()
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.openai_adapter.httpx.Client", FakeClient)
    monkeypatch.setattr("app.services.providers.openai_adapter.time.sleep", lambda seconds: sleep_calls.append(seconds))
    monkeypatch.setattr("app.services.providers.openai_adapter.datetime", DummyDateTime)

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请返回 JSON",
            image_paths=[str(image_path)],
            response_schema={"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
        )
    )

    assert sleep_calls == [pytest.approx(10.0)]
    assert response.success is True
    assert response.normalized_json == {"summary": "ok"}


def test_zhipu_adapter_calls_chat_completions_and_parses_json(monkeypatch, tmp_path):
    image_path = tmp_path / "fire.jpg"
    image_path.write_bytes(b"fake-image")
    captured = {}

    monkeypatch.setattr(
        "app.services.providers.zhipu_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="zhipu",
            display_name="智谱",
            base_url="https://open.bigmodel.cn/api/paas/v4/chat/completions",
            api_key="zhipu-key",
            default_model="glm-4v-plus",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": "<think>analysis</think>\n```json\n"
                            + json.dumps({"summary": "未发现火情", "has_fire": False}, ensure_ascii=False)
                            + "\n```"
                        }
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            captured["timeout"] = kwargs.get("timeout")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.zhipu_adapter.httpx.Client", FakeClient)

    response = ZhipuAdapter().analyze(
        ProviderRequest(
            model="glm-4v-plus",
            prompt="请识别图中是否存在火情",
            image_paths=[str(image_path)],
            response_schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "has_fire": {"type": "boolean"},
                },
                "required": ["summary", "has_fire"],
            },
        )
    )

    assert response.success is True
    assert response.normalized_json == {"summary": "未发现火情", "has_fire": False}
    assert captured["url"] == "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer zhipu-key"
    assert captured["json"]["messages"][1]["content"][0]["type"] == "text"
    assert captured["json"]["messages"][1]["content"][1]["type"] == "image_url"
    assert isinstance(captured["json"]["messages"][1]["content"][1]["image_url"]["url"], str)


def test_openai_adapter_returns_failure_for_refusal(monkeypatch, tmp_path):
    image_path = tmp_path / "blocked.jpg"
    image_path.write_bytes(b"fake-image")

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1/responses",
            api_key="sk-test",
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "refusal",
                                "refusal": "cannot comply",
                            }
                        ],
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.openai_adapter.httpx.Client", FakeClient)

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请识别图片",
            image_paths=[str(image_path)],
            response_schema={"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
        )
    )

    assert response.success is False
    assert response.error_message == "OpenAI refused the request: cannot comply"


def test_google_adapter_calls_generate_content_and_parses_json(monkeypatch, tmp_path):
    image_path = tmp_path / "google.png"
    image_path.write_bytes(b"fake-image")
    captured = {}

    monkeypatch.setattr(
        "app.services.providers.google_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="google",
            display_name="Google Gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta/models",
            api_key="google-test-key",
            default_model="gemini-2.5-flash",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {"summary": "Google 调试完成", "ok": True},
                                        ensure_ascii=False,
                                    )
                                }
                            ]
                        }
                    }
                ],
                "usageMetadata": {
                    "promptTokenCount": 100,
                    "candidatesTokenCount": 30,
                    "totalTokenCount": 130,
                },
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            captured["timeout"] = kwargs.get("timeout")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.google_adapter.httpx.Client", FakeClient)

    response = GoogleAdapter().analyze(
        ProviderRequest(
            model="gemini-2.5-flash",
            prompt="请执行 Google provider 调试",
            image_paths=[str(image_path)],
            response_schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "ok": {"type": "boolean"},
                },
                "required": ["summary", "ok"],
            },
        )
    )

    assert response.success is True
    assert response.normalized_json == {"summary": "Google 调试完成", "ok": True}
    assert captured["url"] == "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    assert captured["headers"]["x-goog-api-key"] == "google-test-key"
    assert captured["json"]["contents"][0]["parts"][0]["text"].startswith("请执行 Google provider 调试")
    assert captured["json"]["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/png"


def test_openai_adapter_text_mode_accepts_plain_text(monkeypatch, tmp_path):
    image_path = tmp_path / "note.jpg"
    image_path.write_bytes(b"fake-image")
    captured = {}

    monkeypatch.setattr(
        "app.services.providers.openai_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1/responses",
            api_key="sk-test",
            default_model="gpt-5-mini",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": "现场未发现异常，可继续巡检。",
                            }
                        ],
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.openai_adapter.httpx.Client", FakeClient)

    response = OpenAIAdapter().analyze(
        ProviderRequest(
            model="gpt-5-mini",
            prompt="请输出一句结论",
            image_paths=[str(image_path)],
            response_format="text",
            response_schema={},
        )
    )

    assert response.success is True
    assert response.normalized_json == {"raw_text": "现场未发现异常，可继续巡检。"}
    assert "text" not in captured["json"]


def test_ark_adapter_calls_chat_completions_and_parses_json(monkeypatch, tmp_path):
    image_path = tmp_path / "ark.jpg"
    image_path.write_bytes(b"fake-image")
    captured = {}

    monkeypatch.setattr(
        "app.services.providers.ark_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="ark",
            display_name="火山方舟",
            base_url="https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            api_key="ark-test-key",
            default_model="ep-123",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps({"summary": "识别完成", "risk_level": "low"}, ensure_ascii=False),
                        }
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("app.services.providers.ark_adapter.httpx.Client", FakeClient)

    response = ArkAdapter().analyze(
        ProviderRequest(
            model="ep-123",
            prompt="请识别图中风险等级",
            image_paths=[str(image_path)],
            response_format="json_object",
            response_schema={},
        )
    )

    assert response.success is True
    assert response.normalized_json == {"summary": "识别完成", "risk_level": "low"}
    assert captured["url"] == "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer ark-test-key"
    assert captured["json"]["messages"][1]["content"][1]["type"] == "image_url"


def test_ark_adapter_http_400_includes_server_detail_and_hint(monkeypatch, tmp_path):
    image_path = tmp_path / "ark-400.jpg"
    image_path.write_bytes(b"fake-image")

    monkeypatch.setattr(
        "app.services.providers.ark_adapter.load_model_provider_runtime",
        lambda _provider: ModelProviderRuntimeConfig(
            provider="ark",
            display_name="火山方舟",
            base_url="https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            api_key="ark-test-key",
            default_model="doubao-seed-2-0-mini-260215",
            timeout_seconds=60,
            status="active",
        ),
    )

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers=None, json=None):
            request = httpx.Request("POST", url)
            return httpx.Response(
                400,
                request=request,
                json={"error": {"message": "Model does not support image input"}},
            )

    monkeypatch.setattr("app.services.providers.ark_adapter.httpx.Client", FakeClient)

    response = ArkAdapter().analyze(
        ProviderRequest(
            model="doubao-seed-2-0-mini-260215",
            prompt="请识别是否有火情",
            image_paths=[str(image_path)],
            response_format="json_object",
            response_schema={},
        )
    )

    assert response.success is False
    assert response.error_message is not None
    assert "Model does not support image input" in response.error_message
    assert "endpoint id" in response.error_message
    assert "支持视觉输入" in response.error_message


def test_provider_factory_maps_doubao_alias_to_ark_adapter():
    adapter = get_provider_adapter("doubao")
    assert isinstance(adapter, ArkAdapter)
