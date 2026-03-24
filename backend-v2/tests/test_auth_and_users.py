def login_as_admin(client):
    return login_as_user(client, username="admin", password="admin123456")


def login_as_user(client, *, username: str, password: str):
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_refresh_and_me(client):
    login_data = login_as_admin(client)
    access_token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]

    me_response = client.get("/api/me", headers=auth_headers(access_token))
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "admin"
    assert "system_admin" in me_response.json()["roles"]

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_response.status_code == 200
    assert refresh_response.json()["user"]["username"] == "admin"
    assert refresh_response.json()["access_token"]


def test_user_create_list_and_disable(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "reviewer1",
            "password": "Passw0rd!",
            "display_name": "复核员一号",
            "roles": ["manual_reviewer", "analysis_viewer"],
        },
    )
    assert create_response.status_code == 200
    created_user = create_response.json()
    assert created_user["username"] == "reviewer1"
    assert set(created_user["roles"]) == {"manual_reviewer", "analysis_viewer"}
    assert created_user["is_active"] is True

    list_response = client.get("/api/users", headers=headers)
    assert list_response.status_code == 200
    usernames = {user["username"] for user in list_response.json()}
    assert {"admin", "reviewer1"}.issubset(usernames)

    disable_response = client.patch(
        f"/api/users/{created_user['id']}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["is_active"] is False


def test_analysis_viewer_has_read_only_access_scope(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_viewer_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "viewer_only",
            "password": "Viewer123!",
            "display_name": "只读分析查看者",
            "roles": ["analysis_viewer"],
        },
    )
    assert create_viewer_response.status_code == 200

    viewer_login = login_as_user(client, username="viewer_only", password="Viewer123!")
    viewer_headers = auth_headers(viewer_login["access_token"])

    assert client.get("/api/dashboard/summary", headers=viewer_headers).status_code == 200
    assert client.get("/api/task-records", headers=viewer_headers).status_code == 200

    assert client.get("/api/users", headers=viewer_headers).status_code == 403
    assert client.get("/api/audit-logs", headers=viewer_headers).status_code == 403

    create_upload_job_response = client.post(
        "/api/jobs/uploads",
        headers=viewer_headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("viewer-upload.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_upload_job_response.status_code == 403


def test_strategy_configurator_can_manage_strategies_but_not_provider_keys(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_configurator_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "strategy_editor",
            "password": "Editor123!",
            "display_name": "策略配置员",
            "roles": ["strategy_configurator"],
        },
    )
    assert create_configurator_response.status_code == 200

    configurator_login = login_as_user(client, username="strategy_editor", password="Editor123!")
    configurator_headers = auth_headers(configurator_login["access_token"])

    list_provider_response = client.get("/api/model-providers", headers=configurator_headers)
    assert list_provider_response.status_code == 200

    update_provider_response = client.put(
        "/api/model-providers/openai",
        headers=configurator_headers,
        json={
            "enabled": True,
            "api_base_url": "https://api.openai.com/v1/responses",
            "default_model": "gpt-5-mini",
            "api_key": "sk-test-key",
            "timeout_seconds": 30,
            "max_requests_per_minute": 30,
        },
    )
    assert update_provider_response.status_code == 403

    create_strategy_response = client.post(
        "/api/strategies",
        headers=configurator_headers,
        json={
            "name": "策略配置员新增策略",
            "scene_description": "用于验证角色权限",
            "prompt_template": "请输出JSON。",
            "model_provider": "zhipu",
            "model_name": "glm-4v-plus",
            "response_schema": {
                "type": "object",
                "properties": {
                    "result": {"type": "string"},
                },
                "required": ["result"],
                "additionalProperties": False,
            },
            "status": "active",
        },
    )
    assert create_strategy_response.status_code == 200
