from .test_auth_and_users import auth_headers, login_as_admin


def test_audit_log_records_mutation_operation(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Audit Camera",
            "location": "审计点位",
            "ip_address": "192.168.10.10",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/audit-camera",
            "frame_frequency_seconds": 15,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/audit-camera",
        },
    )
    assert create_camera_response.status_code == 200

    logs_response = client.get(
        "/api/audit-logs",
        headers=headers,
        params={"http_method": "POST", "request_path": "/api/cameras"},
    )
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) == 1
    assert logs[0]["request_path"] == "/api/cameras"
    assert logs[0]["http_method"] == "POST"
    assert logs[0]["operator_username"] == "admin"
    assert logs[0]["status_code"] == 200
    assert logs[0]["success"] is True
    assert logs[0]["duration_ms"] >= 0


def test_audit_log_records_failed_operation(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    invalid_upload_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("invalid.txt", b"not-image", "text/plain"))],
    )
    assert invalid_upload_response.status_code == 400

    logs_response = client.get(
        "/api/audit-logs",
        headers=headers,
        params={"http_method": "POST", "request_path": "/api/jobs/uploads"},
    )
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) == 1
    assert logs[0]["status_code"] == 400
    assert logs[0]["success"] is False
    assert logs[0]["operator_username"] == "admin"


def test_audit_log_skips_auth_login(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    logs_response = client.get(
        "/api/audit-logs",
        headers=headers,
        params={"request_path": "/api/auth/login"},
    )
    assert logs_response.status_code == 200
    assert logs_response.json() == []


def test_audit_log_requires_system_admin_role(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_user_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "audit-viewer",
            "password": "Passw0rd!",
            "display_name": "Audit Viewer",
            "roles": ["analysis_viewer"],
        },
    )
    assert create_user_response.status_code == 200

    user_login_response = client.post(
        "/api/auth/login",
        json={"username": "audit-viewer", "password": "Passw0rd!"},
    )
    assert user_login_response.status_code == 200
    user_headers = auth_headers(user_login_response.json()["access_token"])

    logs_response = client.get("/api/audit-logs", headers=user_headers)
    assert logs_response.status_code == 403
