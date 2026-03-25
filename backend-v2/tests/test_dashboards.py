from .test_auth_and_users import auth_headers, login_as_admin, login_as_user


def test_dashboard_definition_crud_and_default_switch(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_first_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "默认生产看板",
            "description": "首个默认看板",
            "definition": {
                "widgets": [
                    {"type": "kpi", "metric": "success_rate"},
                    {"type": "line", "metric": "jobs_trend"},
                ]
            },
            "status": "active",
            "is_default": True,
        },
    )
    assert create_first_response.status_code == 200
    first_dashboard = create_first_response.json()
    assert first_dashboard["is_default"] is True
    assert first_dashboard["status"] == "active"

    create_second_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "质量追踪看板",
            "description": "用于异常追踪",
            "definition": {
                "widgets": [
                    {"type": "table", "metric": "anomalies"},
                ]
            },
            "status": "active",
            "is_default": True,
        },
    )
    assert create_second_response.status_code == 200
    second_dashboard = create_second_response.json()
    assert second_dashboard["is_default"] is True

    dashboards_response = client.get("/api/dashboards", headers=headers)
    assert dashboards_response.status_code == 200
    dashboards = dashboards_response.json()
    dashboards_by_id = {item["id"]: item for item in dashboards}
    assert dashboards_by_id[first_dashboard["id"]]["is_default"] is False
    assert dashboards_by_id[second_dashboard["id"]]["is_default"] is True

    update_first_response = client.patch(
        f"/api/dashboards/{first_dashboard['id']}",
        headers=headers,
        json={
            "name": "默认生产看板-v2",
            "status": "inactive",
            "is_default": True,
            "definition": {"widgets": [{"type": "pie", "metric": "anomaly_ratio"}]},
        },
    )
    assert update_first_response.status_code == 200
    updated_first = update_first_response.json()
    assert updated_first["name"] == "默认生产看板-v2"
    assert updated_first["status"] == "inactive"
    assert updated_first["is_default"] is True

    second_detail_response = client.get(f"/api/dashboards/{second_dashboard['id']}", headers=headers)
    assert second_detail_response.status_code == 200
    assert second_detail_response.json()["is_default"] is False

    delete_second_response = client.delete(f"/api/dashboards/{second_dashboard['id']}", headers=headers)
    assert delete_second_response.status_code == 200
    assert delete_second_response.json() == {"deleted": True}


def test_dashboard_definition_status_filter_and_duplicate_name_guard(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_active_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "班组总览",
            "description": "班组维度统计",
            "definition": {"widgets": [{"type": "kpi", "metric": "reviewed_rate"}]},
            "status": "active",
            "is_default": False,
        },
    )
    assert create_active_response.status_code == 200

    create_inactive_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "夜班看板",
            "description": "夜班专项统计",
            "definition": {"widgets": [{"type": "bar", "metric": "strategy_usage"}]},
            "status": "inactive",
            "is_default": False,
        },
    )
    assert create_inactive_response.status_code == 200

    duplicate_name_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "班组总览",
            "description": "重复名称",
            "definition": {"widgets": []},
            "status": "active",
            "is_default": False,
        },
    )
    assert duplicate_name_response.status_code == 400
    assert duplicate_name_response.json()["detail"] == "Dashboard name already exists"

    inactive_list_response = client.get("/api/dashboards?status=inactive", headers=headers)
    assert inactive_list_response.status_code == 200
    inactive_dashboards = inactive_list_response.json()
    assert len(inactive_dashboards) == 1
    assert inactive_dashboards[0]["name"] == "夜班看板"

    invalid_definition_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "非法看板定义",
            "description": "widgets 结构非法",
            "definition": {"widgets": "not-an-array"},
            "status": "active",
            "is_default": False,
        },
    )
    assert invalid_definition_response.status_code == 400
    assert invalid_definition_response.json()["detail"] == "Dashboard widgets must be an array"

    existing_dashboard_id = create_active_response.json()["id"]
    invalid_update_response = client.patch(
        f"/api/dashboards/{existing_dashboard_id}",
        headers=headers,
        json={
            "definition": {
                "widgets": [{"type": "kpi", "metric": "reviewed_rate"}],
                "filters": {"unsupported_key": "x"},
            }
        },
    )
    assert invalid_update_response.status_code == 400
    assert invalid_update_response.json()["detail"] == "Unsupported dashboard filter key: unsupported_key"


def test_dashboard_definition_validate_endpoint_reports_valid_and_invalid_results(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_dashboard_response = client.post(
        "/api/dashboards",
        headers=headers,
        json={
            "name": "可校验看板",
            "description": "用于校验接口测试",
            "definition": {"widgets": [{"type": "kpi", "metric": "total_jobs"}]},
            "status": "active",
            "is_default": False,
        },
    )
    assert create_dashboard_response.status_code == 200
    dashboard = create_dashboard_response.json()

    valid_response = client.post(
        f"/api/dashboards/{dashboard['id']}/validate-definition",
        headers=headers,
        json={
            "definition": {
                "widgets": [
                    {"type": "line", "metric": "jobs_trend"},
                    {"type": "kpi", "metric": "success_rate"},
                ],
                "filters": {
                    "strategy_id": "preset-helmet",
                    "time_range": "7d",
                },
            }
        },
    )
    assert valid_response.status_code == 200
    valid_payload = valid_response.json()
    assert valid_payload["dashboard_id"] == dashboard["id"]
    assert valid_payload["valid"] is True
    assert valid_payload["errors"] == []

    invalid_response = client.post(
        f"/api/dashboards/{dashboard['id']}/validate-definition",
        headers=headers,
        json={
            "dashboard_definition": {
                "widgets": "invalid",
                "filters": {
                    "unsupported_key": "x",
                    "time_range": 7,
                },
            }
        },
    )
    assert invalid_response.status_code == 200
    invalid_payload = invalid_response.json()
    assert invalid_payload["dashboard_id"] == dashboard["id"]
    assert invalid_payload["valid"] is False
    assert "Dashboard widgets must be an array" in invalid_payload["errors"]
    assert "Unsupported dashboard filter key: unsupported_key" in invalid_payload["errors"]
    assert "Dashboard filter time_range must be a string or null" in invalid_payload["errors"]


def test_dashboard_definition_draft_validate_endpoint_reports_results(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    valid_response = client.post(
        "/api/dashboards/validate-definition",
        headers=headers,
        json={
            "definition": {
                "widgets": [{"type": "kpi", "metric": "success_rate"}],
                "filters": {"time_range": "7d"},
            }
        },
    )
    assert valid_response.status_code == 200
    valid_payload = valid_response.json()
    assert valid_payload["dashboard_id"] is None
    assert valid_payload["valid"] is True
    assert valid_payload["errors"] == []

    invalid_response = client.post(
        "/api/dashboards/validate-definition",
        headers=headers,
        json={
            "dashboard_definition": {
                "widgets": "bad",
                "filters": {"unsupported_key": "x"},
            }
        },
    )
    assert invalid_response.status_code == 200
    invalid_payload = invalid_response.json()
    assert invalid_payload["dashboard_id"] is None
    assert invalid_payload["valid"] is False
    assert "Dashboard widgets must be an array" in invalid_payload["errors"]
    assert "Unsupported dashboard filter key: unsupported_key" in invalid_payload["errors"]


def test_dashboard_definition_validate_requires_admin_role(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_viewer_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "dashboard_validate_viewer",
            "password": "Viewer123!",
            "display_name": "看板校验只读用户",
            "roles": ["analysis_viewer"],
        },
    )
    assert create_viewer_response.status_code == 200

    create_dashboard_response = client.post(
        "/api/dashboards",
        headers=admin_headers,
        json={
            "name": "管理员校验看板",
            "description": "用于权限校验",
            "definition": {"widgets": [{"type": "kpi", "metric": "total_jobs"}]},
            "status": "active",
            "is_default": False,
        },
    )
    assert create_dashboard_response.status_code == 200
    dashboard = create_dashboard_response.json()

    viewer_login = login_as_user(client, username="dashboard_validate_viewer", password="Viewer123!")
    viewer_headers = auth_headers(viewer_login["access_token"])

    validate_response = client.post(
        f"/api/dashboards/{dashboard['id']}/validate-definition",
        headers=viewer_headers,
        json={
            "definition": {
                "widgets": [{"type": "kpi", "metric": "total_jobs"}],
            }
        },
    )
    assert validate_response.status_code == 403

    validate_draft_response = client.post(
        "/api/dashboards/validate-definition",
        headers=viewer_headers,
        json={
            "definition": {
                "widgets": [{"type": "kpi", "metric": "total_jobs"}],
            }
        },
    )
    assert validate_draft_response.status_code == 403


def test_analysis_viewer_can_read_dashboards_but_cannot_write(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_viewer_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "dashboard_viewer",
            "password": "Viewer123!",
            "display_name": "看板只读用户",
            "roles": ["analysis_viewer"],
        },
    )
    assert create_viewer_response.status_code == 200

    create_dashboard_response = client.post(
        "/api/dashboards",
        headers=admin_headers,
        json={
            "name": "管理员创建看板",
            "description": "用于权限验证",
            "definition": {"widgets": [{"type": "kpi", "metric": "total_jobs"}]},
            "status": "active",
            "is_default": False,
        },
    )
    assert create_dashboard_response.status_code == 200
    dashboard = create_dashboard_response.json()

    viewer_login = login_as_user(client, username="dashboard_viewer", password="Viewer123!")
    viewer_headers = auth_headers(viewer_login["access_token"])

    list_response = client.get("/api/dashboards", headers=viewer_headers)
    assert list_response.status_code == 200
    listed_dashboards = list_response.json()
    assert len(listed_dashboards) >= 1
    assert any(item["id"] == dashboard["id"] for item in listed_dashboards)

    get_response = client.get(f"/api/dashboards/{dashboard['id']}", headers=viewer_headers)
    assert get_response.status_code == 200

    create_response = client.post(
        "/api/dashboards",
        headers=viewer_headers,
        json={
            "name": "只读用户创建",
            "description": "不应允许",
            "definition": {"widgets": []},
            "status": "active",
            "is_default": False,
        },
    )
    assert create_response.status_code == 403

    patch_response = client.patch(
        f"/api/dashboards/{dashboard['id']}",
        headers=viewer_headers,
        json={"status": "inactive"},
    )
    assert patch_response.status_code == 403

    delete_response = client.delete(
        f"/api/dashboards/{dashboard['id']}",
        headers=viewer_headers,
    )
    assert delete_response.status_code == 403
