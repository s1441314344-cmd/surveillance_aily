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
    assert providers["zhipu"]["provider"] == "zhipu"


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
