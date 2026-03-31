from pathlib import Path

from app.services.camera_capture_service import CameraRecordingPlan
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


def test_camera_manual_photo_capture_and_media_listing(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "拍照测试摄像头",
            "location": "拍照测试位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/photo-capture",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/photo-capture",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    capture_response = client.post(
        f"/api/cameras/{camera['id']}/capture-photo",
        headers=headers,
        json={"source_kind": "manual"},
    )
    assert capture_response.status_code == 200
    capture_result = capture_response.json()
    assert capture_result["success"] is True
    assert capture_result["media"] is not None
    assert capture_result["media"]["media_type"] == "photo"
    assert capture_result["media"]["status"] == "completed"
    assert "photo" in capture_result["media"]["original_name"]

    list_media_response = client.get(f"/api/cameras/{camera['id']}/media", headers=headers)
    assert list_media_response.status_code == 200
    media_items = list_media_response.json()
    assert len(media_items) == 1
    media = media_items[0]
    assert media["camera_id"] == camera["id"]
    assert media["media_type"] == "photo"
    assert "/camera-media/" in media["storage_path"]

    media_file_response = client.get(f"/api/cameras/{camera['id']}/media/{media['id']}/file", headers=headers)
    assert media_file_response.status_code == 200
    assert media_file_response.content

    delete_response = client.delete(f"/api/cameras/{camera['id']}/media/{media['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted"] is True

    list_media_after_delete = client.get(f"/api/cameras/{camera['id']}/media", headers=headers)
    assert list_media_after_delete.status_code == 200
    assert list_media_after_delete.json() == []


def test_camera_video_recording_start_and_stop(client, monkeypatch, tmp_path):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "录制测试摄像头",
            "location": "录制测试位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/video-capture",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": str(tmp_path / "video-capture"),
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    output_path = tmp_path / "clip.mp4"

    def fake_build_recording_plan(*args, **kwargs):
        return CameraRecordingPlan(
            command=["fake-ffmpeg", str(output_path)],
            output_path=str(output_path),
            mime_type="video/mp4",
            file_name="clip.mp4",
            duration_seconds=60,
        )

    class FakeRecordingProcess:
        def __init__(self, *args, **kwargs):
            self.returncode = None

        def poll(self):
            return self.returncode

        def terminate(self):
            self.returncode = 0
            Path(output_path).write_bytes(b"mock-video")

        def wait(self, timeout=None):
            if self.returncode is None:
                self.terminate()
            return self.returncode

        def kill(self):
            self.terminate()

        def communicate(self):
            if self.returncode is None:
                self.returncode = 0
            return b"", b""

    monkeypatch.setattr("app.services.camera_media_service.build_recording_plan", fake_build_recording_plan)
    monkeypatch.setattr("app.services.camera_media_service.subprocess.Popen", FakeRecordingProcess)
    monkeypatch.setattr("app.services.camera_media_service._monitor_recording_completion", lambda *_args: None)

    start_response = client.post(
        f"/api/cameras/{camera['id']}/recordings/start",
        headers=headers,
        json={"duration_seconds": 60, "source_kind": "manual"},
    )
    assert start_response.status_code == 200
    start_result = start_response.json()
    assert start_result["success"] is True
    assert start_result["media"]["media_type"] == "video"
    assert start_result["media"]["status"] == "recording"
    media_id = start_result["media"]["id"]

    stop_response = client.post(
        f"/api/cameras/{camera['id']}/recordings/{media_id}/stop",
        headers=headers,
    )
    assert stop_response.status_code == 200
    stop_result = stop_response.json()
    assert stop_result["success"] is True
    assert stop_result["media"]["stop_requested"] is True


def test_camera_trigger_rule_crud_and_debug(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "触发规则测试摄像头",
            "location": "触发规则测试位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/trigger-rules",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/trigger-rules",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "人员进入触发",
            "event_type": "person",
            "enabled": True,
            "min_confidence": 0.7,
            "min_consecutive_frames": 2,
            "cooldown_seconds": 20,
            "description": "人员出现且连续2帧命中时抽帧",
        },
    )
    assert create_rule_response.status_code == 200
    rule = create_rule_response.json()
    assert rule["event_type"] == "person"
    assert rule["event_key"] == "person"
    assert rule["enabled"] is True

    list_rules_response = client.get(f"/api/cameras/{camera['id']}/trigger-rules", headers=headers)
    assert list_rules_response.status_code == 200
    assert len(list_rules_response.json()) == 1

    debug_hit_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug",
        headers=headers,
        json={
            "signals": {"person": 0.86, "fire": 0.05, "leak": 0.03},
            "consecutive_hits": {"person": 2},
            "dry_run": True,
            "capture_on_match": False,
        },
    )
    assert debug_hit_response.status_code == 200
    debug_hit_result = debug_hit_response.json()
    assert debug_hit_result["matched_count"] == 1
    assert debug_hit_result["results"][0]["matched"] is True
    assert debug_hit_result["results"][0]["reason"] == "命中触发条件"

    update_rule_response = client.patch(
        f"/api/cameras/{camera['id']}/trigger-rules/{rule['id']}",
        headers=headers,
        json={"min_confidence": 0.95},
    )
    assert update_rule_response.status_code == 200
    assert update_rule_response.json()["min_confidence"] == 0.95

    debug_miss_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug",
        headers=headers,
        json={
            "signals": {"person": 0.86},
            "consecutive_hits": {"person": 2},
            "dry_run": True,
            "capture_on_match": False,
        },
    )
    assert debug_miss_response.status_code == 200
    debug_miss_result = debug_miss_response.json()
    assert debug_miss_result["matched_count"] == 0
    assert "置信度不足" in debug_miss_result["results"][0]["reason"]

    delete_rule_response = client.delete(
        f"/api/cameras/{camera['id']}/trigger-rules/{rule['id']}",
        headers=headers,
    )
    assert delete_rule_response.status_code == 200
    assert delete_rule_response.json()["deleted"] is True


def test_camera_trigger_rule_debug_capture_and_cooldown(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "触发规则抓拍摄像头",
            "location": "触发规则抓拍位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/trigger-photo",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/trigger-photo",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_rule_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules",
        headers=headers,
        json={
            "name": "疑似着火触发",
            "event_type": "fire",
            "enabled": True,
            "min_confidence": 0.6,
            "min_consecutive_frames": 1,
            "cooldown_seconds": 30,
            "description": "火情高置信度命中后抓拍",
        },
    )
    assert create_rule_response.status_code == 200
    rule = create_rule_response.json()

    first_debug_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug",
        headers=headers,
        json={
            "signals": {"fire": 0.91},
            "consecutive_hits": {"fire": 1},
            "dry_run": False,
            "capture_on_match": True,
            "source_kind": "trigger_rule",
            "rule_ids": [rule["id"]],
        },
    )
    assert first_debug_response.status_code == 200
    first_debug_result = first_debug_response.json()
    assert first_debug_result["matched_count"] == 1
    assert first_debug_result["results"][0]["matched"] is True
    assert first_debug_result["results"][0]["media"] is not None
    assert first_debug_result["results"][0]["media"]["media_type"] == "photo"
    assert first_debug_result["results"][0]["media"]["source_kind"] == "trigger_rule"

    second_debug_response = client.post(
        f"/api/cameras/{camera['id']}/trigger-rules/debug",
        headers=headers,
        json={
            "signals": {"fire": 0.99},
            "consecutive_hits": {"fire": 1},
            "dry_run": False,
            "capture_on_match": False,
            "rule_ids": [rule["id"]],
        },
    )
    assert second_debug_response.status_code == 200
    second_debug_result = second_debug_response.json()
    assert second_debug_result["matched_count"] == 0
    assert "冷却中" in second_debug_result["results"][0]["reason"]
    assert second_debug_result["results"][0]["cooldown_ok"] is False
