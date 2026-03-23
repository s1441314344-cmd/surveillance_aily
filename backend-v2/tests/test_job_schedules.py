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
