from .test_auth_and_users import auth_headers, login_as_admin


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
