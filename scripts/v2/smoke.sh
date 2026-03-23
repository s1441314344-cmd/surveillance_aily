#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

require_cmd python3

API_BASE_URL="${V2_API_BASE_URL:-http://127.0.0.1:8000}"
SMOKE_SCHEDULE_WAIT_SECONDS="${V2_SMOKE_SCHEDULE_WAIT_SECONDS:-95}"

python3 - <<PY
import json
import csv
import io
import sys
import time
import uuid
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

api_base = "${API_BASE_URL}".rstrip("/")
max_schedule_wait = int("${SMOKE_SCHEDULE_WAIT_SECONDS}")


def request(method, path, *, token=None, json_body=None, form_body=None, files=None, query=None, expected=(200,)):
    url = api_base + path
    if query:
        url += "?" + urllib.parse.urlencode(query)

    headers = {}
    body = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if files is not None:
        boundary = f"----CodexSmoke{uuid.uuid4().hex}"
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        chunks = []
        if form_body:
            for key, value in form_body.items():
                chunks.extend(
                    [
                        f"--{boundary}\r\n".encode(),
                        f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                        str(value).encode(),
                        b"\r\n",
                    ]
                )
        for field_name, filename, content, mime_type in files:
            chunks.extend(
                [
                    f"--{boundary}\r\n".encode(),
                    (
                        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'
                    ).encode(),
                    f"Content-Type: {mime_type}\r\n\r\n".encode(),
                    content,
                    b"\r\n",
                ]
            )
        chunks.append(f"--{boundary}--\r\n".encode())
        body = b"".join(chunks)
    elif json_body is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(json_body).encode()
    elif form_body is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        body = urllib.parse.urlencode(form_body).encode()

    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = resp.read().decode()
            if resp.status not in expected:
                raise RuntimeError(f"{method} {path} -> {resp.status}: {payload}")
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        if exc.code in expected:
            return exc.code, payload
        raise RuntimeError(f"{method} {path} -> {exc.code}: {payload}") from exc


def get_json(method, path, **kwargs):
    _, payload = request(method, path, **kwargs)
    return json.loads(payload)


print(f"[v2-smoke] api base = {api_base}")

health = get_json("GET", "/api/health")
print(f"[v2-smoke] health ok: {health}")

login = get_json(
    "POST",
    "/api/auth/login",
    json_body={"username": "admin", "password": "admin123456"},
)
token = login["access_token"]
print("[v2-smoke] login ok")

upload_job = get_json(
    "POST",
    "/api/jobs/uploads",
    token=token,
    form_body={"strategy_id": "preset-helmet"},
    files=[
        ("files", "smoke-upload-1.jpg", b"smoke-upload-1", "image/jpeg"),
        ("files", "smoke-upload-2.png", b"smoke-upload-2", "image/png"),
    ],
)
upload_job_id = upload_job["id"]
print(f"[v2-smoke] upload job queued: {upload_job_id}")

upload_terminal = None
for _ in range(20):
    upload_terminal = get_json("GET", f"/api/jobs/{upload_job_id}", token=token)
    if upload_terminal["status"] in {"completed", "failed", "cancelled"}:
        break
    time.sleep(1)

if upload_terminal["status"] != "completed":
    raise RuntimeError(f"upload job did not complete: {upload_terminal}")

upload_records = get_json(
    "GET",
    "/api/task-records",
    token=token,
    query={"job_id": upload_job_id},
)
if len(upload_records) != 2:
    raise RuntimeError(f"expected 2 upload records, got {len(upload_records)}")
print("[v2-smoke] upload async flow ok")

non_retryable_status, non_retryable_payload = request(
    "POST",
    f"/api/jobs/{upload_job_id}/retry",
    token=token,
    expected=(409,),
)
if non_retryable_status != 409:
    raise RuntimeError(f"expected 409 for non-retryable job, got {non_retryable_status}")
if "not retryable" not in non_retryable_payload:
    raise RuntimeError(f"unexpected non-retryable response: {non_retryable_payload}")
print("[v2-smoke] non-retryable status guard ok")

failed_camera_name = f"Smoke Failed Camera {uuid.uuid4().hex[:6]}"
failed_camera = get_json(
    "POST",
    "/api/cameras",
    token=token,
    json_body={
        "name": failed_camera_name,
        "location": "smoke-failed",
        "ip_address": "127.0.0.1",
        "port": 554,
        "protocol": "rtsp",
        "username": "operator",
        "password": "secret123",
        "rtsp_url": "bad-rtsp-url",
        "frame_frequency_seconds": 15,
        "resolution": "720p",
        "jpeg_quality": 80,
        "storage_path": "./data/storage/cameras/smoke-failed",
    },
)

failed_job = get_json(
    "POST",
    "/api/jobs/cameras/once",
    token=token,
    json_body={
        "camera_id": failed_camera["id"],
        "strategy_id": "preset-fire",
    },
)
failed_job_id = failed_job["id"]

failed_terminal = None
for _ in range(20):
    failed_terminal = get_json("GET", f"/api/jobs/{failed_job_id}", token=token)
    if failed_terminal["status"] in {"completed", "failed", "cancelled"}:
        break
    time.sleep(1)

if failed_terminal["status"] != "failed":
    raise RuntimeError(f"expected failed job for retry smoke, got: {failed_terminal}")

retry_job = get_json(
    "POST",
    f"/api/jobs/{failed_job_id}/retry",
    token=token,
)
retry_job_id = retry_job["id"]
if retry_job_id == failed_job_id:
    raise RuntimeError("retry should create a new job id")

retry_terminal = None
for _ in range(20):
    retry_terminal = get_json("GET", f"/api/jobs/{retry_job_id}", token=token)
    if retry_terminal["status"] in {"completed", "failed", "cancelled"}:
        break
    time.sleep(1)

if retry_terminal["status"] != "failed":
    raise RuntimeError(f"expected retried job to fail with bad camera source, got: {retry_terminal}")

retry_records = get_json(
    "GET",
    "/api/task-records",
    token=token,
    query={"job_id": retry_job_id},
)
if len(retry_records) != 1:
    raise RuntimeError(f"expected 1 retried record, got {len(retry_records)}")
if retry_records[0]["result_status"] != "failed":
    raise RuntimeError(f"expected failed retried record, got: {retry_records[0]}")
print("[v2-smoke] failed->retry async flow ok")

camera_name = f"Smoke Camera {uuid.uuid4().hex[:6]}"
camera = get_json(
    "POST",
    "/api/cameras",
    token=token,
    json_body={
        "name": camera_name,
        "location": "smoke",
        "ip_address": "127.0.0.1",
        "port": 554,
        "protocol": "rtsp",
        "username": "operator",
        "password": "secret123",
        "rtsp_url": f"rtsp://mock/{uuid.uuid4().hex}",
        "frame_frequency_seconds": 15,
        "resolution": "720p",
        "jpeg_quality": 80,
        "storage_path": "./data/storage/cameras/smoke-runtime",
    },
)

schedule = get_json(
    "POST",
    "/api/job-schedules",
    token=token,
    json_body={
        "camera_id": camera["id"],
        "strategy_id": "preset-fire",
        "schedule_type": "interval_minutes",
        "schedule_value": "1",
    },
)
schedule_id = schedule["id"]
print(f"[v2-smoke] schedule created: {schedule_id}, waiting for trigger")

scheduled_job = None
schedule_state = None
for _ in range(max_schedule_wait):
    schedule_state = get_json("GET", "/api/job-schedules", token=token, query={"camera_id": camera["id"]})[0]
    jobs = get_json("GET", "/api/jobs", token=token, query={"schedule_id": schedule_id})
    if jobs and jobs[0]["status"] in {"completed", "failed", "cancelled"}:
        scheduled_job = jobs[0]
        break
    time.sleep(1)

if scheduled_job is None:
    raise RuntimeError(f"scheduled job not triggered in time: {schedule_state}")
if scheduled_job["status"] != "completed":
    raise RuntimeError(f"scheduled job not completed successfully: {scheduled_job}")

schedule_records = get_json(
    "GET",
    "/api/task-records",
    token=token,
    query={"job_id": scheduled_job["id"]},
)
if len(schedule_records) != 1:
    raise RuntimeError(f"expected 1 scheduled record, got {len(schedule_records)}")

record_created_at_raw = schedule_records[0].get("created_at")
if not record_created_at_raw:
    raise RuntimeError("scheduled record missing created_at")

created_at = datetime.fromisoformat(record_created_at_raw.replace("Z", "+00:00"))
created_from = (created_at - timedelta(seconds=5)).isoformat()
created_to = (created_at + timedelta(seconds=5)).isoformat()

filtered_records = get_json(
    "GET",
    "/api/task-records",
    token=token,
    query={
        "camera_id": camera["id"],
        "created_from": created_from,
        "created_to": created_to,
    },
)
if not any(item["id"] == schedule_records[0]["id"] for item in filtered_records):
    raise RuntimeError("camera/time filtered records do not include scheduled record")

_, export_payload = request(
    "GET",
    "/api/task-records/export",
    token=token,
    query={
        "camera_id": camera["id"],
        "created_from": created_from,
        "created_to": created_to,
    },
)
export_rows = list(csv.DictReader(io.StringIO(export_payload)))
if not any(row["record_id"] == schedule_records[0]["id"] for row in export_rows):
    raise RuntimeError("camera/time filtered export does not include scheduled record")

_, export_empty_payload = request(
    "GET",
    "/api/task-records/export",
    token=token,
    query={
        "camera_id": camera["id"],
        "created_from": (created_at + timedelta(minutes=5)).isoformat(),
    },
)
export_empty_rows = list(csv.DictReader(io.StringIO(export_empty_payload)))
if export_empty_rows:
    raise RuntimeError("expected empty export rows for out-of-range query")

print("[v2-smoke] task-record filter/export flow ok")
print("[v2-smoke] scheduled async flow ok")
print("[v2-smoke] success")
PY
