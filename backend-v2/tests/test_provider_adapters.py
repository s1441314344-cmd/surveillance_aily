import json

from app.services.model_provider_service import ModelProviderRuntimeConfig
from app.services.providers.base import ProviderRequest
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
