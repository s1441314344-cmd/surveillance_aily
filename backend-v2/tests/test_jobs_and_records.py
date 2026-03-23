from app.workers.tasks import process_job

from .test_auth_and_users import auth_headers, login_as_admin


def test_upload_job_and_task_records_flow(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[
            ("files", ("helmet-1.jpg", b"fake-jpg-content-1", "image/jpeg")),
            ("files", ("helmet-2.png", b"fake-png-content-2", "image/png")),
        ],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["strategy_id"] == "preset-helmet"
    assert job["strategy_name"] == "安全帽识别"
    assert job["status"] == "queued"
    assert job["total_items"] == 2
    assert job["completed_items"] == 0

    process_result = process_job(job["id"])
    assert process_result["status"] == "completed"

    list_jobs_response = client.get("/api/jobs", headers=headers)
    assert list_jobs_response.status_code == 200
    assert any(item["id"] == job["id"] for item in list_jobs_response.json())

    get_job_response = client.get(f"/api/jobs/{job['id']}", headers=headers)
    assert get_job_response.status_code == 200
    assert get_job_response.json()["id"] == job["id"]

    list_records_response = client.get("/api/task-records", headers=headers)
    assert list_records_response.status_code == 200
    records = list_records_response.json()
    assert len(records) == 2
    assert all(record["job_id"] == job["id"] for record in records)
    assert all(record["strategy_name"] == "安全帽识别" for record in records)
    assert all(record["normalized_json"] is not None for record in records)

    first_record = records[0]
    get_record_response = client.get(f"/api/task-records/{first_record['id']}", headers=headers)
    assert get_record_response.status_code == 200
    assert get_record_response.json()["input_filename"] in {"helmet-1.jpg", "helmet-2.png"}

    image_response = client.get(f"/api/task-records/{first_record['id']}/image", headers=headers)
    assert image_response.status_code == 200
    assert image_response.content

    export_response = client.get("/api/task-records/export", headers=headers)
    assert export_response.status_code == 200
    assert "record_id,job_id,created_at" in export_response.text


def test_camera_once_job_creates_camera_record(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Mock Fire Camera",
            "location": "测试烟感位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/fire-line",
            "frame_frequency_seconds": 15,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/mock-fire",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_job_response = client.post(
        "/api/jobs/cameras/once",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
        },
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["job_type"] == "camera_once"
    assert job["camera_id"] == camera["id"]
    assert job["status"] == "queued"
    assert job["completed_items"] == 0

    process_result = process_job(job["id"])
    assert process_result["status"] == "completed"

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    record = records[0]
    assert record["source_type"] == "camera"
    assert record["camera_id"] == camera["id"]
    assert record["strategy_name"] == "火情识别"
    assert record["normalized_json"] is not None

    image_response = client.get(f"/api/task-records/{record['id']}/image", headers=headers)
    assert image_response.status_code == 200
    assert image_response.content


def test_cancelled_queued_job_will_not_be_processed(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-cancel.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["status"] == "queued"

    cancel_response = client.post(f"/api/jobs/{job['id']}/cancel", headers=headers)
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "cancelled"

    process_result = process_job(job["id"])
    assert process_result["status"] == "cancelled"

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    assert records_response.json() == []
