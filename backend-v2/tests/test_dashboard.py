from datetime import datetime, timedelta

from app.services.scheduler_service import run_due_job_schedules_once
from app.workers.tasks import process_job

from .test_auth_and_users import auth_headers, login_as_admin


def test_dashboard_summary_trends_and_anomalies(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    upload_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-helmet"},
        files=[
            ("files", ("helmet-1.jpg", b"fake-jpg-content-1", "image/jpeg")),
            ("files", ("helmet-2.png", b"fake-png-content-2", "image/png")),
        ],
    )
    assert upload_job_response.status_code == 200

    upload_job = upload_job_response.json()
    assert upload_job["status"] == "queued"
    assert process_job(upload_job["id"])["status"] == "completed"

    upload_records_response = client.get(f"/api/task-records?job_id={upload_job['id']}", headers=headers)
    assert upload_records_response.status_code == 200
    upload_records = upload_records_response.json()
    target_record = upload_records[0]

    feedback_response = client.post(
        "/api/feedback",
        headers=headers,
        json={
            "record_id": target_record["id"],
            "judgement": "incorrect",
            "corrected_label": "no_helmet",
            "comment": "人工复核后判定为未戴安全帽",
        },
    )
    assert feedback_response.status_code == 200

    create_camera_response = client.post(
        "/api/cameras",
        headers=headers,
        json={
            "name": "Mock Dashboard Camera",
            "location": "总览看板测试位",
            "ip_address": "127.0.0.1",
            "port": 554,
            "protocol": "rtsp",
            "username": "operator",
            "password": "secret123",
            "rtsp_url": "rtsp://mock/dashboard",
            "frame_frequency_seconds": 15,
            "resolution": "720p",
            "jpeg_quality": 80,
            "storage_path": "./data/storage/cameras/dashboard",
        },
    )
    assert create_camera_response.status_code == 200
    camera = create_camera_response.json()

    camera_job_response = client.post(
        "/api/job-schedules",
        headers=headers,
        json={
            "camera_id": camera["id"],
            "strategy_id": "preset-fire",
            "schedule_type": "interval_minutes",
            "schedule_value": "15",
        },
    )
    assert camera_job_response.status_code == 200
    schedule = camera_job_response.json()

    created_job_ids = run_due_job_schedules_once(
        now=(datetime.fromisoformat(schedule["next_run_at"]) + timedelta(seconds=1)),
        dispatch_jobs=False,
    )
    assert len(created_job_ids) == 1
    assert process_job(created_job_ids[0])["status"] == "completed"

    summary_response = client.get("/api/dashboard/summary", headers=headers)
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["total_jobs"] == 2
    assert summary["total_records"] == 3
    assert summary["pending_review_count"] == 2
    assert summary["success_rate"] == 100.0
    assert summary["structured_success_rate"] == 100.0
    assert summary["reviewed_rate"] == 33.33
    assert summary["confirmed_accuracy_rate"] == 0.0
    assert summary["anomaly_rate"] == 33.33

    trends_response = client.get("/api/dashboard/trends", headers=headers)
    assert trends_response.status_code == 200
    trends = trends_response.json()
    assert len(trends) == 1
    assert trends[0]["total_jobs"] == 2
    assert trends[0]["success_rate"] == 100.0

    strategies_response = client.get("/api/dashboard/strategies", headers=headers)
    assert strategies_response.status_code == 200
    strategies = strategies_response.json()
    assert any(item["strategy_name"] == "安全帽识别" and item["usage_count"] == 2 for item in strategies)
    assert any(item["strategy_name"] == "火情识别" and item["usage_count"] == 1 for item in strategies)

    anomalies_response = client.get("/api/dashboard/anomalies", headers=headers)
    assert anomalies_response.status_code == 200
    anomalies = anomalies_response.json()
    assert len(anomalies) == 1
    assert anomalies[0]["record_id"] == target_record["id"]
    assert anomalies[0]["strategy_name"] == "安全帽识别"
