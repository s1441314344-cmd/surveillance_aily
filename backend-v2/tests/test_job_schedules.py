from datetime import datetime, timedelta

from app.core.database import SessionLocal
from app.models.job import Job, JobSchedule
from app.services import schedule_dispatch_service
from app.services.local_detector_service import LocalDetectorError, LocalDetectorResult
from app.services.schedule_dispatch_service import run_due_job_schedules_once
from app.workers.tasks import process_job

from .test_auth_and_users import auth_headers, login_as_admin, login_as_user


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

    delete_schedule_response = client.delete(f"/api/job-schedules/{schedule['id']}", headers=headers)
    assert delete_schedule_response.status_code == 200
    assert delete_schedule_response.json() == {"deleted": True}

    list_after_delete_response = client.get("/api/job-schedules", headers=headers)
    assert list_after_delete_response.status_code == 200
    assert list_after_delete_response.json() == []


def test_job_schedule_update_rejects_invalid_next_run_at(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Invalid Next Run Camera",
            "location": "参数校验点",
            "ip_address": "192.168.1.29",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/invalid-next-run",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/invalid-next-run",
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

    invalid_patch_response = client.patch(
        f"/api/job-schedules/{schedule['id']}",
        headers=headers,
        json={"next_run_at": "not-a-datetime"},
    )
    assert invalid_patch_response.status_code == 400
    assert "next_run_at must be a valid ISO datetime string" in invalid_patch_response.text


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


def test_scheduler_skips_duplicate_dispatch_when_inflight_schedule_job_exists(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Duplicate Guard Camera",
            "location": "防重测试点",
            "ip_address": "192.168.1.67",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/duplicate-guard",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/duplicate-guard",
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
    first_run_at = datetime.fromisoformat(schedule["next_run_at"]) + timedelta(seconds=1)

    first_ids = run_due_job_schedules_once(now=first_run_at, dispatch_jobs=False)
    assert len(first_ids) == 1

    force_due_again_response = client.patch(
        f"/api/job-schedules/{schedule['id']}",
        headers=headers,
        json={
            "next_run_at": (first_run_at - timedelta(seconds=1)).isoformat(),
        },
    )
    assert force_due_again_response.status_code == 200
    forced_schedule = force_due_again_response.json()
    assert forced_schedule["next_run_at"] is not None
    assert datetime.fromisoformat(forced_schedule["next_run_at"]) <= first_run_at

    second_report = schedule_dispatch_service.run_due_job_schedules_once_report(
        now=first_run_at + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert second_report["created_job_ids"] == []
    assert second_report["created_count"] == 0
    assert second_report["skipped_inflight_count"] == 1
    assert second_report["due_count"] >= 1

    jobs_response = client.get(f"/api/jobs?schedule_id={schedule['id']}", headers=headers)
    assert jobs_response.status_code == 200
    jobs = jobs_response.json()
    assert len(jobs) == 1
    assert jobs[0]["id"] == first_ids[0]
    assert jobs[0]["status"] == "queued"

    refreshed_schedule = client.get(f"/api/job-schedules?camera_id={camera['id']}", headers=headers).json()[0]
    assert refreshed_schedule["last_error"] is not None
    assert "Skipped duplicate dispatch" in refreshed_schedule["last_error"]


def test_scheduler_replaces_stale_inflight_job_when_timeout_exceeded(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Stale Guard Camera",
            "location": "超时防重测试点",
            "ip_address": "192.168.1.68",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/stale-duplicate-guard",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/stale-duplicate-guard",
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
    first_run_at = datetime.fromisoformat(schedule["next_run_at"]) + timedelta(seconds=1)

    first_ids = run_due_job_schedules_once(now=first_run_at, dispatch_jobs=False)
    assert len(first_ids) == 1
    first_job_id = first_ids[0]

    stale_created_at = first_run_at - timedelta(minutes=20)
    with SessionLocal() as db:
        first_job = db.get(Job, first_job_id)
        assert first_job is not None
        first_job.created_at = stale_created_at
        first_job.updated_at = stale_created_at
        db.commit()

    force_due_again_response = client.patch(
        f"/api/job-schedules/{schedule['id']}",
        headers=headers,
        json={
            "next_run_at": (first_run_at - timedelta(seconds=1)).isoformat(),
        },
    )
    assert force_due_again_response.status_code == 200
    forced_schedule = force_due_again_response.json()
    assert forced_schedule["next_run_at"] is not None
    assert datetime.fromisoformat(forced_schedule["next_run_at"]) <= first_run_at

    original_timeout_seconds = schedule_dispatch_service.settings.scheduler_inflight_job_timeout_seconds
    monkeypatch.setattr(schedule_dispatch_service.settings, "scheduler_inflight_job_timeout_seconds", 60)
    try:
        second_report = schedule_dispatch_service.run_due_job_schedules_once_report(
            now=first_run_at + timedelta(seconds=1),
            dispatch_jobs=False,
        )
    finally:
        monkeypatch.setattr(
            schedule_dispatch_service.settings,
            "scheduler_inflight_job_timeout_seconds",
            original_timeout_seconds,
        )

    second_ids = second_report["created_job_ids"]
    assert second_report["created_count"] == 1
    assert second_report["stale_failed_count"] == 1
    assert second_report["skipped_inflight_count"] == 0
    assert len(second_ids) == 1
    assert second_ids[0] != first_job_id

    jobs_response = client.get(f"/api/jobs?schedule_id={schedule['id']}", headers=headers)
    assert jobs_response.status_code == 200
    jobs = jobs_response.json()
    assert len(jobs) == 2
    first_job = next(item for item in jobs if item["id"] == first_job_id)
    second_job = next(item for item in jobs if item["id"] == second_ids[0])
    assert first_job["status"] == "failed"
    assert first_job["error_message"] is not None
    assert "stale in-flight timeout" in first_job["error_message"]
    assert second_job["status"] == "queued"


def test_scheduler_locking_path_pulls_due_schedules_iteratively(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    camera_ids: list[str] = []
    for index in range(2):
        create_camera_response = client.post(
            "/api/cameras",
            headers=headers,
            json={
                "name": f"Locking Camera {index}",
                "location": "锁路径测试点",
                "ip_address": f"192.168.1.8{index}",
                "port": 554,
                "protocol": "rtsp",
                "username": "operator",
                "password": "secret123",
                "rtsp_url": f"rtsp://mock/locking-{index}",
                "frame_frequency_seconds": 20,
                "resolution": "720p",
                "jpeg_quality": 80,
                "storage_path": f"./data/storage/cameras/locking-{index}",
            },
        )
        assert create_camera_response.status_code == 200
        camera_ids.append(create_camera_response.json()["id"])

    schedule_ids: list[str] = []
    for camera_id in camera_ids:
        create_schedule_response = client.post(
            "/api/job-schedules",
            headers=headers,
            json={
                "camera_id": camera_id,
                "strategy_id": "preset-fire",
                "schedule_type": "interval_minutes",
                "schedule_value": "10",
            },
        )
        assert create_schedule_response.status_code == 200
        schedule_ids.append(create_schedule_response.json()["id"])

    with SessionLocal() as db:
        schedules = [db.get(JobSchedule, schedule_id) for schedule_id in schedule_ids]
        run_at = max(item.next_run_at for item in schedules if item is not None and item.next_run_at is not None) + timedelta(seconds=1)

    pull_count = {"value": 0}
    queue = list(schedule_ids)

    def fake_take_next_due_schedule_for_update(*, db, now):
        pull_count["value"] += 1
        if not queue:
            return None
        schedule_id = queue.pop(0)
        return db.get(JobSchedule, schedule_id)

    monkeypatch.setattr(schedule_dispatch_service, "_supports_schedule_row_locking", lambda db: True)
    monkeypatch.setattr(
        schedule_dispatch_service,
        "_take_next_due_schedule_for_update",
        fake_take_next_due_schedule_for_update,
    )

    created_ids = run_due_job_schedules_once(now=run_at, dispatch_jobs=False)
    assert len(created_ids) == 2
    assert pull_count["value"] == 3

    jobs_response = client.get("/api/jobs?trigger_mode=schedule", headers=headers)
    assert jobs_response.status_code == 200
    created_schedule_ids = {job["schedule_id"] for job in jobs_response.json()}
    assert set(schedule_ids).issubset(created_schedule_ids)


def test_scheduler_precheck_not_matched_will_skip_job_creation(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Precheck Camera",
            "location": "预判测试点",
            "ip_address": "192.168.1.77",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/precheck-camera",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/precheck-camera",
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
            "precheck_strategy_id": "preset-signal-person-fire-leak",
            "schedule_type": "interval_minutes",
            "schedule_value": "1",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()
    original_next_run_at = schedule["next_run_at"]

    monkeypatch.setattr(
        schedule_dispatch_service,
        "_run_schedule_precheck_if_needed",
        lambda db, schedule, now=None: (False, "Precheck not matched (test)"),
    )

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(original_next_run_at) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert created_job_ids == []

    jobs_response = client.get(f"/api/jobs?schedule_id={schedule['id']}", headers=headers)
    assert jobs_response.status_code == 200
    assert jobs_response.json() == []

    refreshed_schedule_response = client.get(f"/api/job-schedules?camera_id={camera['id']}", headers=headers)
    assert refreshed_schedule_response.status_code == 200
    refreshed_schedule = refreshed_schedule_response.json()[0]
    assert refreshed_schedule["last_run_at"] is not None
    assert refreshed_schedule["next_run_at"] is not None
    assert refreshed_schedule["next_run_at"] != original_next_run_at
    assert refreshed_schedule["last_error"] == "Precheck not matched (test)"


def test_scheduler_precheck_person_hard_gate_skips_model_call(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Precheck Local Gate Camera",
            "location": "预判本地门控测试点",
            "ip_address": "192.168.1.88",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/precheck-local-gate",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/precheck-local-gate",
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
            "precheck_strategy_id": "preset-signal-person-fire-leak",
            "schedule_type": "interval_minutes",
            "schedule_value": "1",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()
    original_next_run_at = schedule["next_run_at"]

    def _fail_if_model_called(*args, **kwargs):
        raise AssertionError("model adapter should not be called when person hard gate blocks precheck")

    monkeypatch.setattr(schedule_dispatch_service, "get_provider_adapter", _fail_if_model_called)
    monkeypatch.setattr(
        schedule_dispatch_service,
        "detect_with_local_detector",
        lambda **kwargs: LocalDetectorResult(
            passed=False,
            reason="local detector gate blocked: person<0.40",
            signals={"person": 0.2},
            response_payload=None,
        ),
    )

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(original_next_run_at) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert created_job_ids == []

    refreshed_schedule_response = client.get(f"/api/job-schedules?camera_id={camera['id']}", headers=headers)
    assert refreshed_schedule_response.status_code == 200
    refreshed_schedule = refreshed_schedule_response.json()[0]
    assert refreshed_schedule["last_error"] is not None
    assert "Precheck blocked by local detector" in refreshed_schedule["last_error"]


def test_scheduler_precheck_detector_unavailable_strict_block(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Precheck Refresh Camera",
            "location": "预判刷新测试点",
            "ip_address": "192.168.1.89",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/precheck-refresh",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/precheck-refresh",
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
            "precheck_strategy_id": "preset-signal-person-fire-leak",
            "precheck_config": {
                "person_threshold": 0.4,
                "state_ttl_seconds": 90,
                "refresh_interval_seconds": 3600,
            },
            "schedule_type": "interval_minutes",
            "schedule_value": "1",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()

    calls = {"count": 0}

    def _fail_if_model_called(*args, **kwargs):
        calls["count"] += 1
        raise AssertionError("model adapter should not be called when detector is unavailable in strict mode")

    def _raise_detector_unavailable(**kwargs):
        raise LocalDetectorError("connection refused")

    monkeypatch.setattr(schedule_dispatch_service, "get_provider_adapter", _fail_if_model_called)
    monkeypatch.setattr(
        schedule_dispatch_service,
        "detect_with_local_detector",
        _raise_detector_unavailable,
    )

    created_job_ids = run_due_job_schedules_once(
        now=datetime.fromisoformat(schedule["next_run_at"]) + timedelta(seconds=1),
        dispatch_jobs=False,
    )
    assert created_job_ids == []
    assert calls["count"] == 0

    refreshed_schedule = client.get(f"/api/job-schedules?camera_id={camera['id']}", headers=headers).json()[0]
    assert "Precheck blocked by local detector" in (refreshed_schedule.get("last_error") or "")


def test_job_schedule_precheck_config_can_be_persisted(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Precheck Config Camera",
            "location": "配置测试点",
            "ip_address": "192.168.1.99",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/precheck-config",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/precheck-config",
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
            "precheck_strategy_id": "preset-signal-person-fire-leak",
            "precheck_config": {
                "person_threshold": 0.65,
                "soft_negative_threshold": 0.15,
                "state_ttl_seconds": 300,
            },
            "schedule_type": "interval_minutes",
            "schedule_value": "5",
        },
    )
    assert create_schedule_response.status_code == 200
    created_schedule = create_schedule_response.json()
    assert created_schedule["precheck_config"] == {
        "person_threshold": 0.65,
        "soft_negative_threshold": 0.15,
        "state_ttl_seconds": 300,
    }

    update_schedule_response = client.patch(
        f"/api/job-schedules/{created_schedule['id']}",
        headers=headers,
        json={
            "precheck_config": {
                "person_threshold": 0.7,
                "soft_negative_threshold": 0.1,
                "state_ttl_seconds": 180,
            }
        },
    )
    assert update_schedule_response.status_code == 200
    updated_schedule = update_schedule_response.json()
    assert updated_schedule["precheck_config"] == {
        "person_threshold": 0.7,
        "soft_negative_threshold": 0.1,
        "state_ttl_seconds": 180,
    }


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


def test_run_schedule_now_creates_camera_schedule_job_and_allows_task_operator(client):
    admin_login = login_as_admin(client)
    admin_headers = auth_headers(admin_login["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=admin_headers,
        json={
            "name": "RunNow Camera",
            "location": "快速触发点位",
            "ip_address": "192.168.1.78",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/run-now",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/run-now",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=admin_headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "15",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()
    original_next_run_at = schedule["next_run_at"]

    create_operator_response = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": "schedule_operator",
            "password": "Schedule123!",
            "display_name": "计划操作员",
            "roles": ["task_operator"],
        },
    )
    assert create_operator_response.status_code == 200

    operator_login = login_as_user(client, username="schedule_operator", password="Schedule123!")
    operator_headers = auth_headers(operator_login["access_token"])

    run_now_response = client.post(
        f"/api/job-schedules/{schedule['id']}/run-now",
        headers=operator_headers,
    )
    assert run_now_response.status_code == 200
    run_now_job = run_now_response.json()
    assert run_now_job["job_type"] == "camera_schedule"
    assert run_now_job["trigger_mode"] == "schedule"
    assert run_now_job["schedule_id"] == schedule["id"]
    assert run_now_job["status"] == "queued"

    assert process_job(run_now_job["id"])["status"] == "completed"

    updated_schedule_response = client.get(f"/api/job-schedules?status=active", headers=admin_headers)
    assert updated_schedule_response.status_code == 200
    updated_schedule = next(item for item in updated_schedule_response.json() if item["id"] == schedule["id"])
    assert updated_schedule["last_run_at"] is not None
    assert updated_schedule["next_run_at"] is not None
    assert updated_schedule["next_run_at"] != original_next_run_at


def test_run_schedule_now_rejects_paused_schedule(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "RunNow Paused Camera",
            "location": "暂停计划测试点",
            "ip_address": "192.168.1.79",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/run-now-paused",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/run-now-paused",
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

    pause_response = client.patch(
        f"/api/job-schedules/{schedule['id']}/status",
        headers=headers,
        json={"status": "paused"},
    )
    assert pause_response.status_code == 200
    assert pause_response.json()["status"] == "paused"

    run_now_response = client.post(
        f"/api/job-schedules/{schedule['id']}/run-now",
        headers=headers,
    )
    assert run_now_response.status_code == 400
    assert "Schedule is not active" in run_now_response.json()["detail"]
