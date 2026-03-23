#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median
from typing import Any

import httpx


TERMINAL_JOB_STATUSES = {"completed", "failed", "cancelled"}


@dataclass
class CreatedJob:
    job_id: str
    create_latency_ms: int
    created_at: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="V2 上传任务性能压测脚本")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="API 基础地址")
    parser.add_argument("--username", default="admin", help="登录用户名")
    parser.add_argument("--password", default="admin123456", help="登录密码")
    parser.add_argument("--jobs", type=int, default=20, help="提交任务总数")
    parser.add_argument("--concurrency", type=int, default=5, help="并发提交数")
    parser.add_argument("--files-per-job", type=int, default=1, help="每个任务上传文件数")
    parser.add_argument("--strategy-id", default="preset-helmet", help="策略 ID")
    parser.add_argument("--poll-timeout-seconds", type=int, default=180, help="轮询等待任务完成超时")
    parser.add_argument("--poll-interval-seconds", type=float, default=1.0, help="轮询间隔")
    parser.add_argument("--output-json", default="", help="将结果输出到 JSON 文件")
    return parser.parse_args()


def login(api_base: str, username: str, password: str) -> str:
    response = httpx.post(
        f"{api_base.rstrip('/')}/api/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def create_upload_job(
    api_base: str,
    token: str,
    strategy_id: str,
    files_per_job: int,
    index: int,
) -> CreatedJob:
    files = []
    for file_index in range(files_per_job):
        filename = f"perf-{index}-{file_index}.jpg"
        file_content = f"perf-image-content-{index}-{file_index}".encode()
        files.append(("files", (filename, file_content, "image/jpeg")))

    started_at = time.perf_counter()
    with httpx.Client(timeout=20) as client:
        response = client.post(
            f"{api_base.rstrip('/')}/api/jobs/uploads",
            headers={"Authorization": f"Bearer {token}"},
            data={"strategy_id": strategy_id},
            files=files,
        )
    create_latency_ms = int((time.perf_counter() - started_at) * 1000)
    response.raise_for_status()
    payload = response.json()
    return CreatedJob(
        job_id=payload["id"],
        create_latency_ms=create_latency_ms,
        created_at=payload.get("created_at"),
    )


def poll_jobs(
    api_base: str,
    token: str,
    job_ids: list[str],
    timeout_seconds: int,
    interval_seconds: float,
) -> dict[str, dict[str, Any]]:
    started_at = time.monotonic()
    pending = set(job_ids)
    final_jobs: dict[str, dict[str, Any]] = {}
    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=20) as client:
        while pending and (time.monotonic() - started_at) <= timeout_seconds:
            for job_id in list(pending):
                response = client.get(f"{api_base.rstrip('/')}/api/jobs/{job_id}", headers=headers)
                if response.status_code >= 400:
                    continue
                payload = response.json()
                if payload.get("status") in TERMINAL_JOB_STATUSES:
                    final_jobs[job_id] = payload
                    pending.remove(job_id)

            if pending:
                time.sleep(interval_seconds)

    return final_jobs


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def percentile(values: list[int], q: float) -> int:
    if not values:
        return 0
    if len(values) == 1:
        return values[0]
    sorted_values = sorted(values)
    index = int(math.ceil((q / 100) * len(sorted_values))) - 1
    index = max(0, min(index, len(sorted_values) - 1))
    return sorted_values[index]


def summarize(
    created_jobs: list[CreatedJob],
    final_jobs: dict[str, dict[str, Any]],
    started_at: float,
    finished_at: float,
) -> dict[str, Any]:
    create_latencies = [item.create_latency_ms for item in created_jobs]
    total_jobs = len(created_jobs)
    status_counts: dict[str, int] = {}
    completion_latencies: list[int] = []

    for job in final_jobs.values():
        status = str(job.get("status", "unknown"))
        status_counts[status] = status_counts.get(status, 0) + 1

    created_map = {item.job_id: item for item in created_jobs}
    for job_id, job in final_jobs.items():
        created_at = parse_iso_datetime(created_map.get(job_id).created_at if job_id in created_map else None)
        finished_at_dt = parse_iso_datetime(job.get("finished_at"))
        if created_at and finished_at_dt:
            completion_latencies.append(int((finished_at_dt - created_at).total_seconds() * 1000))

    completed = status_counts.get("completed", 0)
    failed = status_counts.get("failed", 0)
    cancelled = status_counts.get("cancelled", 0)
    unresolved = total_jobs - len(final_jobs)
    duration_seconds = max(finished_at - started_at, 0.001)

    return {
        "submitted_jobs": total_jobs,
        "resolved_jobs": len(final_jobs),
        "unresolved_jobs": unresolved,
        "status_counts": status_counts,
        "completed": completed,
        "failed": failed,
        "cancelled": cancelled,
        "create_latency_ms": {
            "p50": percentile(create_latencies, 50),
            "p95": percentile(create_latencies, 95),
            "avg": int(sum(create_latencies) / len(create_latencies)) if create_latencies else 0,
            "median": int(median(create_latencies)) if create_latencies else 0,
        },
        "completion_latency_ms": {
            "p50": percentile(completion_latencies, 50),
            "p95": percentile(completion_latencies, 95),
            "avg": int(sum(completion_latencies) / len(completion_latencies)) if completion_latencies else 0,
            "median": int(median(completion_latencies)) if completion_latencies else 0,
        },
        "throughput_jobs_per_second": round(total_jobs / duration_seconds, 2),
        "duration_seconds": round(duration_seconds, 2),
    }


def main() -> int:
    args = parse_args()
    api_base = args.api_base.rstrip("/")
    token = login(api_base, args.username, args.password)

    started_at = time.monotonic()
    created_jobs: list[CreatedJob] = []
    create_errors: list[str] = []

    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as executor:
        futures = [
            executor.submit(
                create_upload_job,
                api_base,
                token,
                args.strategy_id,
                max(1, args.files_per_job),
                index,
            )
            for index in range(max(1, args.jobs))
        ]
        for future in as_completed(futures):
            try:
                created_jobs.append(future.result())
            except Exception as exc:  # pragma: no cover - best effort diagnostics
                create_errors.append(str(exc))

    if create_errors:
        print("create errors:")
        for error in create_errors[:5]:
            print(f"  - {error}")

    created_jobs.sort(key=lambda item: item.job_id)
    final_jobs = poll_jobs(
        api_base,
        token,
        [item.job_id for item in created_jobs],
        timeout_seconds=max(1, args.poll_timeout_seconds),
        interval_seconds=max(0.2, args.poll_interval_seconds),
    )
    finished_at = time.monotonic()

    summary = summarize(created_jobs, final_jobs, started_at, finished_at)
    summary["api_base"] = api_base
    summary["strategy_id"] = args.strategy_id
    summary["files_per_job"] = max(1, args.files_per_job)
    summary["concurrency"] = max(1, args.concurrency)

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as output_file:
            json.dump(summary, output_file, ensure_ascii=False, indent=2)

    if summary["failed"] > 0 or summary["unresolved_jobs"] > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
