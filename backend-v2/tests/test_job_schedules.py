from datetime import datetime, timedelta

from app.services.scheduler_service import run_due_job_schedules_once
from app.workers.tasks import process_job

from .test_auth_and_users import auth_headers, login_as_admin


def test_job_schedule_crud_and_status_flow(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Schedule Camera",
            "location": "西门岗",
            "ip_address": "192.168.1.22",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/schedule",
            "frame_frequency_seconds": 20,
            "resolution": "1080p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/schedule",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "15",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()
    assert schedule["camera_id"] == camera["id"]
    assert schedule["strategy_id"] == "preset-fire"
    assert schedule["status"] == "active"
    assert schedule["next_run_at"] is not None

    list_schedule_response = client.get("/api/job-schedules", headers=headers)
    assert list_schedule_response.status_code == 200
    schedules = list_schedule_response.json()
    assert len(schedules) == 1
    assert schedules[0]["id"] == schedule["id"]

    update_schedule_response = client.patch(
        f"/api/job-schedules/{schedule['id']}",
        headers=headers,
        json={
            "schedule_type": "daily_time",
            "schedule_value": "08:30",
        },
    )
    assert update_schedule_response.status_code == 200
    assert update_schedule_response.json()["schedule_type"] == "daily_time"
    assert update_schedule_response.json()["schedule_value"] == "08:30"
    assert update_schedule_response.json()["next_run_at"] is not None

    pause_schedule_response = client.patch(
        f"/api/job-schedules/{schedule['id']}/status",
        headers=headers,
        json={"status": "paused"},
    )
    assert pause_schedule_response.status_code == 200
    assert pause_schedule_response.json()["status"] == "paused"
    assert pause_schedule_response.json()["next_run_at"] is None

    active_schedule_response = client.patch(
        f"/api/job-schedules/{schedule['id']}/status",
        headers=headers,
        json={"status": "active"},
    )
    assert active_schedule_response.status_code == 200
    assert active_schedule_response.json()["status"] == "active"
    assert active_schedule_response.json()["next_run_at"] is not None

    filtered_schedule_response = client.get("/api/job-schedules?status=active", headers=headers)
    assert filtered_schedule_response.status_code == 200
    assert len(filtered_schedule_response.json()) == 1


def test_scheduler_creates_camera_schedule_job_and_updates_runtime_fields(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Scheduler Camera",
            "location": "北门岗",
            "ip_address": "192.168.1.33",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/scheduler",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/scheduler",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "10",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()
    original_next_run_at = schedule["next_run_at"]

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(original_next_run_at) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert len(created_job_ids) == 1

    jobs_response = client.get("/api/jobs?trigger_mode=schedule&schedule_id=" + schedule["id"], headers=headers)
    assert jobs_response.status_code == 200
    jobs = jobs_response.json()
    assert len(jobs) == 1
    assert jobs[0]["id"] == created_job_ids[0]
    assert jobs[0]["status"] == "queued"
    assert jobs[0]["schedule_id"] == schedule["id"]

    updated_schedules_response = client.get("/api/job-schedules?status=active", headers=headers)
    assert updated_schedules_response.status_code == 200
    updated_schedule = updated_schedules_response.json()[0]
    assert updated_schedule["last_run_at"] is not None
    assert updated_schedule["next_run_at"] is not None
    assert updated_schedule["next_run_at"] != original_next_run_at

    assert process_job(created_job_ids[0])["status"] == "completed"


def test_paused_schedule_will_not_trigger_and_failed_schedule_job_updates_last_error(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Paused Camera",
            "location": "仓库",
            "ip_address": "192.168.1.44",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "bad-rtsp-url",
            "frame_frequency_seconds": 30,
            "resolution": "1080p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/paused",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "daily_time",
            "schedule_value": "08:00",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()

    pause_response = client.patch(
        f"/api/job-schedules/{schedule['id']}/status",
        headers=headers,
        json={"status": "paused"},
    )
    assert pause_response.status_code == 200

    created_job_ids = run_due_job_schedules_once(now=datetime.now() + timedelta(days=1), dispatch_jobs=False)
    assert created_job_ids == []

    resume_response = client.patch(
        f"/api/job-schedules/{schedule['id']}/status",
        headers=headers,
        json={"status": "active"},
    )
    assert resume_response.status_code == 200
    resumed_schedule = resume_response.json()

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(resumed_schedule["next_run_at"]) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert len(created_job_ids) == 1
    assert process_job(created_job_ids[0])["status"] == "failed"

    refreshed_schedules_response = client.get("/api/job-schedules?status=active", headers=headers)
    assert refreshed_schedules_response.status_code == 200
    refreshed_schedule = refreshed_schedules_response.json()[0]
    assert refreshed_schedule["last_error"] is not None


def test_scheduler_trigger_failure_writes_schedule_last_error(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Missing Camera",
            "location": "临时测试点",
            "ip_address": "192.168.1.66",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/missing-camera",
            "frame_frequency_seconds": 30,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/missing-camera",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "10",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()

    delete_camera_response = client.delete(f"/api/cameras/{camera['id']}", headers=headers)
    assert delete_camera_response.status_code == 200

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(schedule["next_run_at"]) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert created_job_ids == []

    schedules_response = client.get("/api/job-schedules?status=active", headers=headers)
    assert schedules_response.status_code == 200
    schedules = schedules_response.json()
    assert any(item["id"] == schedule["id"] for item in schedules)
    refreshed_schedule = next(item for item in schedules if item["id"] == schedule["id"])
    assert refreshed_schedule["last_error"] is not None
    assert "Camera not found" in refreshed_schedule["last_error"]
    assert refreshed_schedule["last_run_at"] is not None
    assert refreshed_schedule["next_run_at"] is not None


def test_list_jobs_filters_by_trigger_mode_camera_and_schedule_id(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Filter Camera",
            "location": "过滤测试位",
            "ip_address": "192.168.1.77",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/filter",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/filter",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "5",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(schedule["next_run_at"]) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert len(created_job_ids) == 1
    scheduled_job_id = created_job_ids[0]

    create_manual_job_response = client.post(
        "/api/jobs/cameras/once",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
        },
    )
    assert create_manual_job_response.status_code == 200

    by_trigger_mode_response = client.get("/api/jobs?trigger_mode=schedule", headers=headers)
    assert by_trigger_mode_response.status_code == 200
    by_trigger_mode = by_trigger_mode_response.json()
    assert len(by_trigger_mode) == 1
    assert by_trigger_mode[0]["id"] == scheduled_job_id

    by_camera_response = client.get(f"/api/jobs?camera_id={camera['id']}", headers=headers)
    assert by_camera_response.status_code == 200
    by_camera = by_camera_response.json()
    assert len(by_camera) == 2

    by_schedule_response = client.get(f"/api/jobs?schedule_id={schedule['id']}", headers=headers)
    assert by_schedule_response.status_code == 200
    by_schedule = by_schedule_response.json()
    assert len(by_schedule) == 1
    assert by_schedule[0]["id"] == scheduled_job_id
