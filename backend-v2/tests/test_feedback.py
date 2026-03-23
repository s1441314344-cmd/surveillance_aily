from app.workers.tasks import process_job

from .test_auth_and_users import auth_headers, login_as_admin


def test_feedback_create_update_and_record_status(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_job_response = client.post(
        "/api/jobs/uploads",
        headers=headers,
        data={"strategy_id": "preset-fire"},
        files=[("files", ("fire-1.jpg", b"fake-jpg-content-1", "image/jpeg"))],
    )
    assert create_job_response.status_code == 200
    job = create_job_response.json()
    assert job["status"] == "queued"

    process_result = process_job(job["id"])
    assert process_result["status"] == "completed"

    records_response = client.get(f"/api/task-records?job_id={job['id']}", headers=headers)
    assert records_response.status_code == 200
    record = records_response.json()[0]
    assert record["feedback_status"] == "unreviewed"

    create_feedback_response = client.post(
        "/api/feedback",
        headers=headers,
        json={
            "record_id": record["id"],
            "judgement": "incorrect",
            "corrected_label": "no_fire",
            "comment": "现场确认是反光误报",
        },
    )
    assert create_feedback_response.status_code == 200
    feedback = create_feedback_response.json()
    assert feedback["judgement"] == "incorrect"
    assert feedback["reviewer"] == "测试管理员"

    record_after_feedback = client.get(f"/api/task-records/{record['id']}", headers=headers)
    assert record_after_feedback.status_code == 200
    assert record_after_feedback.json()["feedback_status"] == "incorrect"

    list_feedback_response = client.get(f"/api/feedback?record_id={record['id']}", headers=headers)
    assert list_feedback_response.status_code == 200
    assert len(list_feedback_response.json()) == 1

    update_feedback_response = client.patch(
        f"/api/feedback/{feedback['id']}",
        headers=headers,
        json={
            "judgement": "correct",
            "comment": "二次复核确认模型判断正确",
        },
    )
    assert update_feedback_response.status_code == 200
    assert update_feedback_response.json()["judgement"] == "correct"

    final_record_response = client.get(f"/api/task-records/{record['id']}", headers=headers)
    assert final_record_response.status_code == 200
    assert final_record_response.json()["feedback_status"] == "correct"

    filtered_records_response = client.get("/api/task-records?feedback_status=correct", headers=headers)
    assert filtered_records_response.status_code == 200
    assert any(item["id"] == record["id"] for item in filtered_records_response.json())
