from app.services.providers.base import ProviderResponse

from .test_auth_and_users import auth_headers, login_as_admin


def test_model_provider_upsert_and_mask(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    update_response = client.put(
        "/api/model-providers/openai",
        headers=headers,
        json={
            "display_name": "OpenAI",
            "base_url": "https://api.openai.com/v1/responses",
            "api_key": "sk-test-123456",
            "default_model": "gpt-5-mini",
            "timeout_seconds": 180,
            "status": "active",
        },
    )
    assert update_response.status_code == 200
    body = update_response.json()
    assert body["provider"] == "openai"
    assert body["has_api_key"] is True
    assert body["api_key_masked"] != "sk-test-123456"

    list_response = client.get("/api/model-providers", headers=headers)
    assert list_response.status_code == 200
    providers = {item["provider"]: item for item in list_response.json()}
    assert providers["openai"]["status"] == "active"
    assert providers["google"]["provider"] == "google"
    assert providers["zhipu"]["provider"] == "zhipu"


def test_model_provider_debug_returns_logs_and_output(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    client.put(
        "/api/model-providers/openai",
        headers=headers,
        json={
            "display_name": "OpenAI",
            "base_url": "https://api.openai.com/v1/responses",
            "api_key": "sk-test-123456",
            "default_model": "gpt-5-mini",
            "timeout_seconds": 180,
            "status": "active",
        },
    )

    class FakeAdapter:
        def analyze(self, request):
            assert request.model == "gpt-5-mini"
            assert request.response_format == "text"
            return ProviderResponse(
                success=True,
                raw_response="provider debug ok",
                normalized_json={"raw_text": "provider debug ok"},
                error_message=None,
                usage={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            )

    monkeypatch.setattr(
        "app.services.model_provider_service.get_provider_adapter",
        lambda provider: FakeAdapter(),
    )

    response = client.post(
        "/api/model-providers/openai/debug",
        headers=headers,
        json={
            "model": "gpt-5-mini",
            "prompt": "请返回调试成功。",
            "response_format": "text",
            "include_sample_image": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["provider"] == "openai"
    assert body["model"] == "gpt-5-mini"
    assert body["request_payload"]["include_sample_image"] is False
    assert body["raw_response"] == "provider debug ok"
    assert len(body["logs"]) >= 2

    call_logs_response = client.get(
        "/api/model-providers/call-logs?provider=openai&trigger_type=provider_debug&limit=20",
        headers=headers,
    )
    assert call_logs_response.status_code == 200
    call_logs = call_logs_response.json()
    assert len(call_logs) >= 1
    latest = call_logs[0]
    assert latest["provider"] == "openai"
    assert latest["trigger_type"] == "provider_debug"
    assert latest["success"] is True


def test_model_provider_debug_rejects_inactive_provider(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    client.put(
        "/api/model-providers/google",
        headers=headers,
        json={
            "display_name": "Google Gemini",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/models",
            "api_key": "google-test-key",
            "default_model": "gemini-2.5-flash",
            "timeout_seconds": 120,
            "status": "inactive",
        },
    )

    response = client.post(
        "/api/model-providers/google/debug",
        headers=headers,
        json={
            "prompt": "请返回调试成功。",
            "response_format": "text",
            "include_sample_image": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["status"] == "inactive"
    assert body["error_message"] == "Model provider is inactive"
    assert any("未启用状态" in item["message"] for item in body["logs"])


def test_model_provider_debug_rejects_missing_api_key(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    client.put(
        "/api/model-providers/ark",
        headers=headers,
        json={
            "display_name": "豆包 / 火山方舟",
            "base_url": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            "default_model": "doubao-seed-2-0-mini-260215",
            "timeout_seconds": 120,
            "status": "active",
        },
    )

    response = client.post(
        "/api/model-providers/ark/debug",
        headers=headers,
        json={
            "prompt": "请返回调试成功。",
            "response_format": "text",
            "include_sample_image": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["has_api_key"] is False
    assert body["error_message"] == "Model provider API key is missing"
    assert any("未配置 API Key" in item["message"] for item in body["logs"])


def test_model_provider_doubao_alias_updates_ark_provider(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    update_response = client.put(
        "/api/model-providers/doubao",
        headers=headers,
        json={
            "display_name": "豆包 / 火山方舟",
            "base_url": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            "api_key": "ark-test-123456",
            "default_model": "ep-202603280001",
            "timeout_seconds": 120,
            "status": "active",
        },
    )
    assert update_response.status_code == 200
    body = update_response.json()
    assert body["provider"] == "ark"
    assert body["display_name"] == "豆包 / 火山方舟"

    list_response = client.get("/api/model-providers", headers=headers)
    assert list_response.status_code == 200
    providers = {item["provider"]: item for item in list_response.json()}
    assert "ark" in providers
    assert providers["ark"]["default_model"] == "ep-202603280001"
    assert providers["ark"]["status"] == "active"


def test_model_provider_doubao_alias_debug_uses_ark_runtime(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    client.put(
        "/api/model-providers/doubao",
        headers=headers,
        json={
            "display_name": "豆包 / 火山方舟",
            "base_url": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            "api_key": "ark-test-123456",
            "default_model": "ep-202603280001",
            "timeout_seconds": 120,
            "status": "active",
        },
    )

    class FakeAdapter:
        def analyze(self, request):
            return ProviderResponse(
                success=True,
                raw_response="ark alias debug ok",
                normalized_json={"raw_text": "ark alias debug ok"},
                error_message=None,
                usage={"input_tokens": 2, "output_tokens": 2, "total_tokens": 4},
            )

    monkeypatch.setattr(
        "app.services.model_provider_service.get_provider_adapter",
        lambda provider: FakeAdapter(),
    )

    response = client.post(
        "/api/model-providers/doubao/debug",
        headers=headers,
        json={
            "prompt": "请返回调试成功。",
            "response_format": "text",
            "include_sample_image": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["provider"] == "ark"
    assert body["raw_response"] == "ark alias debug ok"


def test_strategy_crud_and_schema_validation(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/strategies",
        headers=headers,
        json={
            "name": "测试策略",
            "scene_description": "测试策略场景说明",
            "prompt_template": "请输出结构化 JSON",
            "model_provider": "zhipu",
            "model_name": "glm-4v-plus",
            "result_format": "json_schema",
            "response_schema": {
                "type": "object",
                "properties": {
                    "result": {"type": "string"},
                    "ok": {"type": "boolean"},
                },
                "required": ["result", "ok"],
            },
            "status": "active",
        },
    )
    assert create_response.status_code == 200
    strategy = create_response.json()
    assert strategy["version"] == 1
    assert strategy["is_preset"] is False

    get_response = client.get(f"/api/strategies/{strategy['id']}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "测试策略"

    update_response = client.patch(
        f"/api/strategies/{strategy['id']}",
        headers=headers,
        json={"prompt_template": "请严格输出 JSON Schema", "model_name": "glm-4v-flash"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["version"] == 2

    status_response = client.patch(
        f"/api/strategies/{strategy['id']}/status",
        headers=headers,
        json={"status": "inactive"},
    )
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "inactive"

    validate_response = client.post(
        f"/api/strategies/{strategy['id']}/validate-schema",
        headers=headers,
        json={"schema": {"type": "not-a-valid-jsonschema-type"}},
    )
    assert validate_response.status_code == 200
    assert validate_response.json()["valid"] is False

    list_response = client.get("/api/strategies?status=inactive", headers=headers)
    assert list_response.status_code == 200
    assert any(item["id"] == strategy["id"] for item in list_response.json())


def test_strategy_create_rejects_empty_response_schema(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/strategies",
        headers=headers,
        json={
            "name": "空 Schema 策略",
            "scene_description": "用于验证空 schema 防呆",
            "prompt_template": "请输出 JSON",
            "model_provider": "zhipu",
            "model_name": "glm-4v-plus",
            "result_format": "json_schema",
            "response_schema": {},
            "status": "active",
        },
    )
    assert create_response.status_code == 400
    assert "Response schema cannot be empty" in str(create_response.json()["detail"])


def test_strategy_update_rejects_empty_response_schema(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/strategies",
        headers=headers,
        json={
            "name": "更新空 Schema 校验策略",
            "scene_description": "先创建正常 schema，再尝试改为空",
            "prompt_template": "请输出结构化 JSON",
            "model_provider": "zhipu",
            "model_name": "glm-4v-plus",
            "result_format": "json_schema",
            "response_schema": {
                "type": "object",
                "properties": {"result": {"type": "string"}},
                "required": ["result"],
            },
            "status": "active",
        },
    )
    assert create_response.status_code == 200
    strategy = create_response.json()

    update_response = client.patch(
        f"/api/strategies/{strategy['id']}",
        headers=headers,
        json={"response_schema": {}},
    )
    assert update_response.status_code == 400
    assert "Response schema cannot be empty" in str(update_response.json()["detail"])


def test_strategy_text_format_allows_empty_schema(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/strategies",
        headers=headers,
        json={
            "name": "文本输出策略",
            "scene_description": "允许文本结果",
            "prompt_template": "请直接返回一句结论。",
            "model_provider": "zhipu",
            "model_name": "glm-4v-plus",
            "result_format": "text",
            "response_schema": {},
            "status": "active",
        },
    )
    assert create_response.status_code == 200
    strategy = create_response.json()
    assert strategy["result_format"] == "text"
    assert strategy["response_schema"] == {}
