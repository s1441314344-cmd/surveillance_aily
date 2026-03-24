import csv
from datetime import datetime, timedelta
from io import BytesIO, StringIO
from pathlib import Path
from zipfile import ZipFile

from app.core.database import SessionLocal
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.services.providers.base import ProviderResponse
from app.services.providers.factory import get_provider_adapter
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
    job_after_process = get_job_response.json()
    assert job_after_process["id"] == job["id"]
    assert job_after_process["status"] == "completed"
    assert job_after_process["started_at"] is not None
    assert job_after_process["finished_at"] is not None

    list_records_response = client.get("/api/task-records", headers=headers)
    assert list_records_response.status_code == 200
    records = list_records_response.json()
    assert len(records) == 2
    assert all(record["job_id"] == job["id"] for record in records)
    assert all(record["strategy_name"] == "安全帽识别" for record in records)
    assert all(record["normalized_json"] is not None for record in records)
    assert all(record["job_type"] == "upload_batch" for record in records)
    assert all(record["schedule_id"] is None for record in records)

    first_record = records[0]
    get_record_response = client.get(f"/api/task-records/{first_record['id']}", headers=headers)
    assert get_record_response.status_code == 200
    assert get_record_response.json()["input_filename"] in {"helmet-1.jpg", "helmet-2.png"}

    image_response = client.get(f"/api/task-records/{first_record['id']}/image", headers=headers)
    assert image_response.status_code == 200
    assert image_response.content

    export_response = client.get("/api/task-records/export", headers=headers)
    assert export_response.status_code == 200
    assert "record_id,job_id,job_type,schedule_id,created_at" in export_response.text
    export_rows = list(csv.DictReader(StringIO(export_response.text)))
    assert len(export_rows) == 2
    assert all(row["job_type"] == "upload_batch" for row in export_rows)
    assert all(row["schedule_id"] == "" for row in export_rows)
    assert all(row["camera_id"] == "" for row in export_rows)

    export_xlsx_response = client.get("/api/task-records/export?format=xlsx", headers=headers)
    assert export_xlsx_response.status_code == 200
    assert (
        export_xlsx_response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert 'filename="task-records.xlsx"' in export_xlsx_response.headers["content-disposition"]
    assert export_xlsx_response.content.startswith(b"PK")

    with ZipFile(BytesIO(export_xlsx_response.content), "r") as workbook:
        sheet_xml = workbook.read("xl/worksheets/sheet1.xml").decode("utf-8")
        assert "record_id" in sheet_xml
        assert "job_type" in sheet_xml
        assert "helmet-1.jpg" in sheet_xml or "helmet-2.png" in sheet_xml


def test_upload_job_rejects_unsupported_file_extension(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet.txt", b"plain-text", "text/plain"))],
    )
    assert create_job_response.status_code == 400
    assert "Unsupported file format" in create_job_response.json()["detail"]


def test_run_job_inline_endpoint_processes_queued_job(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-run-inline.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    queued_job = create_job_response.json()
    assert queued_job["status"] == "queued"

    run_inline_response = client.post(f"/api/jobs/{queued_job['id']}/run", headers=headers)
    assert run_inline_response.status_code == 200
    processed_job = run_inline_response.json()
    assert processed_job["id"] == queued_job["id"]
    assert processed_job["status"] == "completed"
    assert processed_job["started_at"] is not None
    assert processed_job["finished_at"] is not None

    records_response = client.get(f"/api/task-records?job_id={queued_job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["job_id"] == queued_job["id"]


def test_upload_job_rejects_unsupported_content_type(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet.jpg", b"fake-jpg-content", "application/json"))],
    )
    assert create_job_response.status_code == 400
    assert "Unsupported content type" in create_job_response.json()["detail"]


def test_task_records_export_rejects_unsupported_format(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    export_response = client.get("/api/task-records/export?format=pdf", headers=headers)
    assert export_response.status_code == 400
    assert "Unsupported export format" in export_response.json()["detail"]


def test_upload_job_rejects_empty_file(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-empty.jpg", b"", "image/jpeg"))],
    )
    assert create_job_response.status_code == 400
    assert "Empty file is not allowed" in create_job_response.json()["detail"]


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
    assert record["job_type"] == "camera_once"
    assert record["schedule_id"] is None

    image_response = client.get(f"/api/task-records/{record['id']}/image", headers=headers)
    assert image_response.status_code == 200
    assert image_response.content


def test_camera_once_job_onvif_protocol_fails_with_clear_message(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "ONVIF Camera",
            "location": "测试ONVIF点位",
            "ip_address": "127.0.0.1",
            "port": 80,
            "protocol": "onvif",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/onvif-fallback",
            "frame_frequency_seconds": 15,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/mock-onvif",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()
    assert camera["protocol"] == "onvif"

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
    assert job["status"] == "queued"

    process_result = process_job(job["id"])
    assert process_result["status"] == "failed"

    job_detail_response = client.get(f"/api/jobs/{job['id']}", headers=headers)
    assert job_detail_response.status_code == 200
    failed_job = job_detail_response.json()
    assert failed_job["status"] == "failed"
    assert "only RTSP is supported" in (failed_job["error_message"] or "")

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["result_status"] == "failed"
    assert "only RTSP is supported" in records[0]["raw_model_response"]


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


def test_upload_job_invalid_json_response_is_marked_as_schema_invalid(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-invalid-json.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["status"] == "queued"

    class InvalidJsonAdapter:
        def analyze(self, _request):
            return ProviderResponse(
                success=False,
                raw_response="not-json",
                normalized_json=None,
                error_message="Zhipu did not return valid JSON content",
            )

    monkeypatch.setattr(
        "app.services.job_execution_service.get_provider_adapter",
        lambda _provider: InvalidJsonAdapter(),
    )

    process_result = process_job(job["id"])
    assert process_result["status"] == "failed"

    job_response = client.get(f"/api/jobs/{job['id']}", headers=headers)
    assert job_response.status_code == 200
    processed_job = job_response.json()
    assert processed_job["status"] == "failed"
    assert "valid JSON content" in (processed_job["error_message"] or "")

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["result_status"] == "schema_invalid"
    assert records[0]["raw_model_response"] == "not-json"


def test_upload_job_schema_mismatch_is_marked_as_schema_invalid(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-schema-mismatch.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["status"] == "queued"

    class SchemaMismatchAdapter:
        def analyze(self, _request):
            return ProviderResponse(
                success=True,
                raw_response='{"summary":"only-summary"}',
                normalized_json={"summary": "only-summary"},
                error_message=None,
            )

    monkeypatch.setattr(
        "app.services.job_execution_service.get_provider_adapter",
        lambda _provider: SchemaMismatchAdapter(),
    )

    process_result = process_job(job["id"])
    assert process_result["status"] == "failed"

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["result_status"] == "schema_invalid"
    assert records[0]["normalized_json"] == {"summary": "only-summary"}

    job_response = client.get(f"/api/jobs/{job['id']}", headers=headers)
    assert job_response.status_code == 200
    processed_job = job_response.json()
    assert processed_job["status"] == "failed"
    assert "schema validation" in (processed_job["error_message"] or "")


def test_running_job_collaborative_cancel_stops_following_records(client, monkeypatch):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[
            ("files", ("helmet-running-1.jpg", b"fake-jpg-content-1", "image/jpeg")),
            ("files", ("helmet-running-2.jpg", b"fake-jpg-content-2", "image/jpeg")),
        ],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["status"] == "queued"

    base_adapter = get_provider_adapter("zhipu")

    class CancelAfterFirstAnalyzeAdapter:
        def __init__(self):
            self.call_count = 0

        def analyze(self, request):
            self.call_count += 1
            if self.call_count == 1:
                with SessionLocal() as db:
                    db_job = db.get(Job, job["id"])
                    assert db_job is not None
                    db_job.status = "cancelled"
                    db.commit()
            return base_adapter.analyze(request)

    monkeypatch.setattr(
        "app.services.job_execution_service.get_provider_adapter",
        lambda _provider: CancelAfterFirstAnalyzeAdapter(),
    )

    process_result = process_job(job["id"])
    assert process_result["status"] == "cancelled"

    get_job_response = client.get(f"/api/jobs/{job['id']}", headers=headers)
    assert get_job_response.status_code == 200
    cancelled_job = get_job_response.json()
    assert cancelled_job["status"] == "cancelled"
    assert cancelled_job["started_at"] is not None
    assert cancelled_job["finished_at"] is not None
    assert cancelled_job["completed_items"] == 1
    assert cancelled_job["total_items"] == 2

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["input_filename"] == "helmet-running-1.jpg"


def test_retry_failed_camera_job_creates_new_queued_job(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Retry Failed Camera",
            "location": "重试测试位",
            "ip_address": "192.168.1.88",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "bad-rtsp-url",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/retry-failed",
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
    failed_job = create_job_response.json()
    assert process_job(failed_job["id"])["status"] == "failed"

    retry_response = client.post(f"/api/jobs/{failed_job['id']}/retry", headers=headers)
    assert retry_response.status_code == 200
    retried_job = retry_response.json()

    assert retried_job["id"] != failed_job["id"]
    assert retried_job["status"] == "queued"
    assert retried_job["job_type"] == failed_job["job_type"]
    assert retried_job["trigger_mode"] == "manual"
    assert retried_job["camera_id"] == failed_job["camera_id"]
    assert retried_job["strategy_id"] == failed_job["strategy_id"]
    assert retried_job["completed_items"] == 0
    assert retried_job["failed_items"] == 0
    assert retried_job["error_message"] is None

    with SessionLocal() as db:
        persisted_retried_job = db.get(Job, retried_job["id"])
        assert persisted_retried_job is not None
        assert (persisted_retried_job.payload or {}).get("retry_of_job_id") == failed_job["id"]
        assert (persisted_retried_job.payload or {}).get("requested_by") == "admin"

    assert process_job(retried_job["id"])["status"] == "failed"


def test_retry_non_retryable_job_returns_conflict(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-retry-conflict.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    queued_job = create_job_response.json()
    assert queued_job["status"] == "queued"

    retry_response = client.post(f"/api/jobs/{queued_job['id']}/retry", headers=headers)
    assert retry_response.status_code == 409
    assert "not retryable" in retry_response.json()["detail"]


def test_camera_schedule_task_record_contains_job_runtime_fields(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Schedule Runtime Camera",
            "location": "计划来源字段测试位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/schedule-runtime",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/schedule-runtime",
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

    run_now_response = client.post(
        f"/api/job-schedules/{schedule['id']}/run-now",
        headers=headers,
    )
    assert run_now_response.status_code == 200
    job = run_now_response.json()
    assert job["job_type"] == "camera_schedule"
    assert job["schedule_id"] == schedule["id"]

    assert process_job(job["id"])["status"] == "completed"

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) == 1
    assert records[0]["job_type"] == "camera_schedule"
    assert records[0]["schedule_id"] == schedule["id"]


def test_task_records_filter_by_camera_and_time_range(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Record Filter Camera",
            "location": "记录过滤位",
            "ip_address": "192.168.1.99",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/record-filter",
            "frame_frequency_seconds": 20,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/record-filter",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    create_camera_job_response = client.post(
        "/api/jobs/cameras/once",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
        },
    )
    assert create_camera_job_response.status_code == 200
    camera_job = create_camera_job_response.json()
    assert process_job(camera_job["id"])["status"] == "completed"

    create_upload_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("record-filter-upload.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_upload_job_response.status_code == 200
    upload_job = create_upload_job_response.json()
    assert process_job(upload_job["id"])["status"] == "completed"

    camera_records_response = client.get(
        "/api/task-records",
        headers=headers,
        params={"camera_id": camera["id"]},
    )
    assert camera_records_response.status_code == 200
    camera_records = camera_records_response.json()
    assert len(camera_records) == 1
    assert camera_records[0]["job_id"] == camera_job["id"]
    assert camera_records[0]["camera_id"] == camera["id"]

    created_at = datetime.fromisoformat(camera_records[0]["created_at"])
    created_from = (created_at - timedelta(seconds=5)).isoformat()
    created_to = (created_at + timedelta(seconds=5)).isoformat()

    in_range_response = client.get(
        "/api/task-records",
        headers=headers,
        params={
            "camera_id": camera["id"],
            "created_from": created_from,
            "created_to": created_to,
        },
    )
    assert in_range_response.status_code == 200
    in_range_records = in_range_response.json()
    assert len(in_range_records) == 1
    assert in_range_records[0]["id"] == camera_records[0]["id"]

    out_of_range_response = client.get(
        "/api/task-records",
        headers=headers,
        params={
            "camera_id": camera["id"],
            "created_from": (created_at + timedelta(minutes=5)).isoformat(),
        },
    )
    assert out_of_range_response.status_code == 200
    assert out_of_range_response.json() == []

    export_in_range_response = client.get(
        "/api/task-records/export",
        headers=headers,
        params={
            "camera_id": camera["id"],
            "created_from": created_from,
            "created_to": created_to,
        },
    )
    assert export_in_range_response.status_code == 200
    export_rows = list(csv.DictReader(StringIO(export_in_range_response.text)))
    assert len(export_rows) == 1
    assert export_rows[0]["record_id"] == camera_records[0]["id"]
    assert export_rows[0]["camera_id"] == camera["id"]
    assert export_rows[0]["job_type"] == "camera_once"

    export_out_of_range_response = client.get(
        "/api/task-records/export",
        headers=headers,
        params={
            "camera_id": camera["id"],
            "created_from": (created_at + timedelta(minutes=5)).isoformat(),
        },
    )
    assert export_out_of_range_response.status_code == 200
    export_rows_out_of_range = list(csv.DictReader(StringIO(export_out_of_range_response.text)))
    assert export_rows_out_of_range == []


def test_task_record_image_forbids_paths_outside_storage_root(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[("files", ("helmet-safe.jpg", b"fake-jpg-content", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert process_job(job["id"])["status"] == "completed"

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    record_id = records_response.json()[0]["id"]

    with SessionLocal() as db:
        record = db.get(TaskRecord, record_id)
        assert record is not None
        record.input_image_path = str(Path(__file__).resolve())
        db.commit()

    image_response = client.get(f"/api/task-records/{record_id}/image", headers=headers)
    assert image_response.status_code == 403
    assert image_response.json()["detail"] == "Image file access denied"
