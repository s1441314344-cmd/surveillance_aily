from __future__ import annotations

import csv
from datetime import datetime, timedelta, timezone
from io import BytesIO, StringIO
from pathlib import Path
from zipfile import ZipFile


def _wait_for_job_status(client, headers, job_id: str, expected_status: str, *, timeout_seconds: float = 30):
    import time

    deadline = time.monotonic() + timeout_seconds
    last_payload = None
    while time.monotonic() < deadline:
        response = client.get(f"/api/jobs/{job_id}", headers=headers)
        assert response.status_code == 200
        payload = response.json()
        last_payload = payload
        if payload["status"] == expected_status:
            return payload
        time.sleep(0.5)
    raise AssertionError(f"job {job_id} did not reach {expected_status}: {last_payload}")


def _wait_for_records(client, headers, *, job_id: str, expected_count: int, timeout_seconds: float = 30):
    import time

    deadline = time.monotonic() + timeout_seconds
    last_records = None
    while time.monotonic() < deadline:
        response = client.get("/api/task-records", headers=headers, params={"job_id": job_id})
        assert response.status_code == 200
        records = response.json()
        last_records = records
        if len(records) == expected_count:
            return records
        time.sleep(0.5)
    raise AssertionError(f"job {job_id} did not produce {expected_count} records: {last_records}")


def _create_mock_camera(client, headers, *, name: str, suffix: str, storage_root: Path) -> dict:
    response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": name,
            "location": "集成测试点位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": f"rtsp://mock/{suffix}",
            "frame_frequency_seconds": 15,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": str(storage_root / "cameras" / suffix),
        },
    )
    assert response.status_code == 200
    return response.json()


def test_upload_job_async_end_to_end(client, admin_headers, runtime_process_manager):
    runtime_process_manager(worker=True, scheduler=False)

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=admin_headers,
        data={"strategy_id": "preset-helmet"},
        files=[
            ("files", ("helmet-async-1.jpg", b"fake-jpg-content-1", "image/jpeg")),
            ("files", ("helmet-async-2.png", b"fake-png-content-2", "image/png")),
        ],
    )
    assert create_job_response.status_code == 200
    queued_job = create_job_response.json()
    assert queued_job["status"] == "queued"
    assert queued_job["total_items"] == 2

    completed_job = _wait_for_job_status(
        client,
        admin_headers,
        queued_job["id"],
        "completed",
    )
    assert completed_job["completed_items"] == 2
    assert completed_job["failed_items"] == 0
    assert completed_job["started_at"] is not None
    assert completed_job["finished_at"] is not None

    records = _wait_for_records(
        client,
        admin_headers,
        job_id=queued_job["id"],
        expected_count=2,
    )
    assert all(record["job_id"] == queued_job["id"] for record in records)
    assert all(record["job_type"] == "upload_batch" for record in records)
    assert all(record["result_status"] == "completed" for record in records)
    assert all(Path(record["input_image_path"]).exists() for record in records)


def test_schedule_due_job_end_to_end(
    client,
    admin_headers,
    runtime_process_manager,
    db_session,
    app_modules,
    runtime_environment,
):
    runtime_process_manager(worker=True, scheduler=True)

    camera = _create_mock_camera(
        client,
        admin_headers,
        name="Schedule Camera",
        suffix="schedule-integration",
        storage_root=runtime_environment["storage_root"],
    )
    assert Path(camera["storage_path"]).is_relative_to(runtime_environment["storage_root"])
    create_schedule_response = client.post(
        "/api/job-schedules",
        headers=admin_headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "5",
        },
    )
    assert create_schedule_response.status_code == 200
    schedule = create_schedule_response.json()

    persisted_schedule = db_session.get(app_modules["JobSchedule"], schedule["id"])
    persisted_schedule.next_run_at = datetime.now(timezone.utc) - timedelta(seconds=5)
    db_session.commit()

    import time

    deadline = time.monotonic() + 30
    created_job = None
    while time.monotonic() < deadline:
        jobs_response = client.get("/api/jobs", headers=admin_headers, params={"schedule_id": schedule["id"]})
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        if jobs:
            created_job = jobs[0]
            break
        time.sleep(0.5)

    assert created_job is not None
    assert created_job["schedule_id"] == schedule["id"]
    assert created_job["job_type"] == "camera_schedule"

    completed_job = _wait_for_job_status(client, admin_headers, created_job["id"], "completed")
    assert completed_job["camera_id"] == camera["id"]

    records = _wait_for_records(client, admin_headers, job_id=created_job["id"], expected_count=1)
    assert records[0]["camera_id"] == camera["id"]
    assert records[0]["job_type"] == "camera_schedule"
    assert records[0]["schedule_id"] == schedule["id"]
    assert Path(records[0]["input_image_path"]).exists()
    assert Path(records[0]["input_image_path"]).is_relative_to(runtime_environment["storage_root"])

    refreshed_schedule = client.get(
        "/api/job-schedules",
        headers=admin_headers,
        params={"camera_id": camera["id"]},
    ).json()[0]
    assert refreshed_schedule["last_run_at"] is not None
    assert refreshed_schedule["next_run_at"] is not None
    assert refreshed_schedule["last_error"] is None


def test_task_record_export_on_postgres(client, admin_headers, runtime_process_manager):
    runtime_process_manager(worker=True, scheduler=False)

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=admin_headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-export.jpg", b"fake-export-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()

    _wait_for_job_status(client, admin_headers, job["id"], "completed")
    records = _wait_for_records(client, admin_headers, job_id=job["id"], expected_count=1)
    detail_response = client.get(f"/api/task-records/{records[0]['id']}", headers=admin_headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()

    export_response = client.get("/api/task-records/export", headers=admin_headers, params={"job_id": job["id"]})
    assert export_response.status_code == 200
    rows = list(csv.DictReader(StringIO(export_response.text)))
    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == detail["job_id"]
    assert row["job_type"] == detail["job_type"]
    assert row["schedule_id"] == ""
    assert row["strategy_id"] == detail["strategy_id"]
    assert row["strategy_name"] == detail["strategy_name"]
    assert row["input_filename"] == detail["input_filename"]
    assert row["source_type"] == detail["source_type"]
    assert row["camera_id"] == ""
    assert row["result_status"] == detail["result_status"]
    assert row["normalized_json"]
    assert row["raw_model_response"]

    export_xlsx_response = client.get(
        "/api/task-records/export",
        headers=admin_headers,
        params={"job_id": job["id"], "format": "xlsx"},
    )
    assert export_xlsx_response.status_code == 200
    assert export_xlsx_response.content.startswith(b"PK")
    with ZipFile(BytesIO(export_xlsx_response.content), "r") as workbook:
        worksheet = workbook.read("xl/worksheets/sheet1.xml").decode("utf-8")
        assert "record_id" in worksheet
        assert detail["input_filename"] in worksheet
        assert detail["job_id"] in worksheet
