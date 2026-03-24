from app.services.scheduler_service import run_camera_status_sweep_once
from .test_auth_and_users import auth_headers, login_as_admin, login_as_user


def test_camera_crud_and_status_check(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "一号摄像头",
            "location": "东侧门岗",
            "ip_address": "192.168.1.10",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://192.168.1.10/live",
            "frame_frequency_seconds": 30,
            "resolution": "1080p",
            "jpeg_quality": 85,
            "storage_path": "./data/storage/cameras/gate-1",
        },
    )
    assert create_response.status_code == 200
    camera = create_response.json()
    assert camera["name"] == "一号摄像头"
    assert camera["has_password"] is True

    list_response = client.get("/api/cameras", headers=headers)
    assert list_response.status_code == 200
    assert any(item["id"] == camera["id"] for item in list_response.json())

    status_response = client.get(f"/api/cameras/{camera['id']}/status", headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["connection_status"] == "unknown"

    check_response = client.post(f"/api/cameras/{camera['id']}/check", headers=headers)
    assert check_response.status_code == 200
    assert check_response.json()["connection_status"] == "online"
    assert check_response.json()["alert_status"] == "normal"

    update_response = client.patch(
        f"/api/cameras/{camera['id']}",
        headers=headers,
        json={"resolution": "720p", "frame_frequency_seconds": 15},
    )
    assert update_response.status_code == 200
    assert update_response.json()["resolution"] == "720p"

    delete_response = client.delete(f"/api/cameras/{camera['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted"] is True


def test_camera_diagnose_success_and_failure(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    success_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "诊断成功摄像头",
            "location": "测试位A",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/diag-ok",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/diag-success",
        },
    )
    assert success_camera_response.status_code == 200
    success_camera = success_camera_response.json()

    diagnose_response = client.post(f"/api/cameras/{success_camera['id']}/diagnose", headers=headers)
    assert diagnose_response.status_code == 200
    diagnostic = diagnose_response.json()
    assert diagnostic["success"] is True
    assert diagnostic["capture_mode"] == "mock"
    assert diagnostic["mime_type"] == "image/png"
    assert diagnostic["frame_size_bytes"] is not None
    assert diagnostic["snapshot_path"] is not None

    failed_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "诊断失败摄像头",
            "location": "测试位B",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "bad-rtsp-url",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/diag-failed",
        },
    )
    assert failed_camera_response.status_code == 200
    failed_camera = failed_camera_response.json()

    failed_diagnose_response = client.post(f"/api/cameras/{failed_camera['id']}/diagnose", headers=headers)
    assert failed_diagnose_response.status_code == 200
    failed_diagnostic = failed_diagnose_response.json()
    assert failed_diagnostic["success"] is False
    assert "rtsp://" in failed_diagnostic["error_message"].lower()
    assert failed_diagnostic["snapshot_path"] is None


def test_list_camera_statuses_with_alert_filter_and_camera_ids(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    ok_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "状态正常摄像头",
            "location": "状态测试位A",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/status-ok",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/status-ok",
        },
    )
    assert ok_camera_response.status_code == 200
    ok_camera = ok_camera_response.json()

    bad_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "状态异常摄像头",
            "location": "状态测试位B",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "bad-rtsp-url",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/status-bad",
        },
    )
    assert bad_camera_response.status_code == 200
    bad_camera = bad_camera_response.json()

    assert client.post(f"/api/cameras/{ok_camera['id']}/check", headers=headers).status_code == 200
    assert client.post(f"/api/cameras/{bad_camera['id']}/check", headers=headers).status_code == 200

    all_statuses_response = client.get("/api/cameras/statuses", headers=headers)
    assert all_statuses_response.status_code == 200
    all_statuses = all_statuses_response.json()
    assert len(all_statuses) == 2
    status_map = {item["camera_id"]: item for item in all_statuses}
    assert status_map[ok_camera["id"]]["alert_status"] == "normal"
    assert status_map[bad_camera["id"]]["alert_status"] == "error"

    alert_only_response = client.get("/api/cameras/statuses?alert_only=true", headers=headers)
    assert alert_only_response.status_code == 200
    alert_only = alert_only_response.json()
    assert len(alert_only) == 1
    assert alert_only[0]["camera_id"] == bad_camera["id"]

    filtered_response = client.get(f"/api/cameras/statuses?camera_ids={ok_camera['id']}", headers=headers)
    assert filtered_response.status_code == 200
    filtered_statuses = filtered_response.json()
    assert len(filtered_statuses) == 1
    assert filtered_statuses[0]["camera_id"] == ok_camera["id"]


def test_scheduler_camera_status_sweep_generates_status_logs(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    ok_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "状态巡检正常摄像头",
            "location": "巡检位A",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/sweep-ok",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/sweep-ok",
        },
    )
    assert ok_camera_response.status_code == 200
    ok_camera = ok_camera_response.json()

    bad_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "状态巡检异常摄像头",
            "location": "巡检位B",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "bad-rtsp-url",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/sweep-bad",
        },
    )
    assert bad_camera_response.status_code == 200
    bad_camera = bad_camera_response.json()

    summary = run_camera_status_sweep_once()
    assert summary["total_count"] == 2
    assert summary["checked_count"] == 2
    assert summary["failed_count"] == 0

    statuses_response = client.get("/api/cameras/statuses", headers=headers)
    assert statuses_response.status_code == 200
    statuses = statuses_response.json()
    assert len(statuses) == 2
    status_map = {item["camera_id"]: item for item in statuses}
    assert status_map[ok_camera["id"]]["connection_status"] == "online"
    assert status_map[ok_camera["id"]]["alert_status"] == "normal"
    assert status_map[bad_camera["id"]]["connection_status"] == "offline"
    assert status_map[bad_camera["id"]]["alert_status"] == "error"
    assert status_map[bad_camera["id"]]["last_error"] is not None


def test_scheduler_camera_status_sweep_returns_zero_without_cameras():
    summary = run_camera_status_sweep_once()
    assert summary["total_count"] == 0
    assert summary["checked_count"] == 0
    assert summary["failed_count"] == 0


def test_check_all_cameras_status_endpoint_supports_subset_and_all(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    ok_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "批量巡检正常摄像头",
            "location": "批量巡检位A",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/batch-check-ok",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/batch-check-ok",
        },
    )
    assert ok_camera_response.status_code == 200
    ok_camera = ok_camera_response.json()

    bad_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "批量巡检异常摄像头",
            "location": "批量巡检位B",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "bad-rtsp-url",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/batch-check-bad",
        },
    )
    assert bad_camera_response.status_code == 200
    bad_camera = bad_camera_response.json()

    subset_response = client.post(f"/api/cameras/check-all?camera_ids={ok_camera['id']}", headers=headers)
    assert subset_response.status_code == 200
    subset_summary = subset_response.json()
    assert subset_summary["total_count"] == 1
    assert subset_summary["checked_count"] == 1
    assert subset_summary["failed_count"] == 0

    statuses_after_subset = client.get("/api/cameras/statuses", headers=headers)
    assert statuses_after_subset.status_code == 200
    subset_status_map = {item["camera_id"]: item for item in statuses_after_subset.json()}
    assert subset_status_map[ok_camera["id"]]["connection_status"] == "online"
    assert subset_status_map[bad_camera["id"]]["connection_status"] == "unknown"

    all_response = client.post("/api/cameras/check-all", headers=headers)
    assert all_response.status_code == 200
    all_summary = all_response.json()
    assert all_summary["total_count"] == 2
    assert all_summary["checked_count"] == 2
    assert all_summary["failed_count"] == 0

    statuses_after_all = client.get("/api/cameras/statuses", headers=headers)
    assert statuses_after_all.status_code == 200
    all_status_map = {item["camera_id"]: item for item in statuses_after_all.json()}
    assert all_status_map[ok_camera["id"]]["connection_status"] == "online"
    assert all_status_map[bad_camera["id"]]["connection_status"] == "offline"

    status_logs_response = client.get(f"/api/cameras/{bad_camera['id']}/status-logs?limit=1", headers=headers)
    assert status_logs_response.status_code == 200
    status_logs = status_logs_response.json()
    assert len(status_logs) == 1
    assert status_logs[0]["camera_id"] == bad_camera["id"]
    assert status_logs[0]["connection_status"] == "offline"
    assert status_logs[0]["alert_status"] == "error"
    assert status_logs[0]["created_at"] is not None


def test_check_all_cameras_status_requires_system_admin_role(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_operator_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "camera_operator_only",
            "password": "Operator123!",
            "display_name": "摄像头操作员",
            "roles": ["task_operator"],
        },
    )
    assert create_operator_response.status_code == 200

    operator_login = login_as_user(client, username="camera_operator_only", password="Operator123!")
    operator_headers = auth_headers(operator_login["access_token"])

    response = client.post("/api/cameras/check-all", headers=operator_headers)
    assert response.status_code == 403
