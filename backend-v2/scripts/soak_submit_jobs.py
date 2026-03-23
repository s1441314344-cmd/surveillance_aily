#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

import httpx


TERMINAL_JOB_STATUSES = {"completed", "failed", "cancelled"}


@dataclass
class SubmittedJob:
    job_id: str
    create_latency_ms: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="V2 异步任务稳定性回归脚本（多轮高频提交）")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000", help="API 基础地址")
    parser.add_argument("--username", default="admin", help="登录用户名")
    parser.add_argument("--password", default="admin123456", help="登录密码")
    parser.add_argument("--strategy-id", default="preset-helmet", help="上传任务使用的策略 ID")
    parser.add_argument("--rounds", type=int, default=3, help="执行轮数")
    parser.add_argument("--jobs-per-round", type=int, default=10, help="每轮提交任务数")
    parser.add_argument("--concurrency", type=int, default=5, help="每轮并发提交数")
    parser.add_argument("--files-per-job", type=int, default=1, help="每个任务上传图片数")
    parser.add_argument("--sleep-between-rounds-seconds", type=float, default=2.0, help="轮次间隔秒数")
    parser.add_argument("--poll-timeout-seconds", type=int, default=180, help="每轮轮询超时时间")
    parser.add_argument("--poll-interval-seconds", type=float, default=1.0, help="轮询间隔")
    parser.add_argument("--max-unresolved", type=int, default=0, help="允许未收敛任务数上限")
    parser.add_argument("--max-failed", type=int, default=0, help="允许失败任务数上限")
    parser.add_argument("--output-json", default="", help="输出 JSON 报告路径")
    return parser.parse_args()


def login(api_base: str, username: str, password: str) -> str:
    response = httpx.post(
        f"{api_base.rstrip('/')}/api/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def submit_upload_job(
    api_base: str,
    token: str,
    strategy_id: str,
    files_per_job: int,
    round_index: int,
    job_index: int,
) -> SubmittedJob:
    files = []
    for file_index in range(files_per_job):
        filename = f"soak-r{round_index}-j{job_index}-f{file_index}.jpg"
        file_content = f"soak-image-{round_index}-{job_index}-{file_index}".encode()
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
    return SubmittedJob(job_id=payload["id"], create_latency_ms=create_latency_ms)


def poll_until_terminal(
    api_base: str,
    token: str,
    job_ids: list[str],
    *,
    timeout_seconds: int,
    interval_seconds: float,
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    pending = set(job_ids)
    final_jobs: dict[str, dict[str, Any]] = {}
    headers = {"Authorization": f"Bearer {token}"}
    started_at = time.monotonic()

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

    unresolved = sorted(pending)
    return final_jobs, unresolved


def run_round(
    *,
    api_base: str,
    token: str,
    strategy_id: str,
    files_per_job: int,
    concurrency: int,
    round_index: int,
    jobs_per_round: int,
    poll_timeout_seconds: int,
    poll_interval_seconds: float,
) -> dict[str, Any]:
    round_started_at = time.monotonic()
    submitted_jobs: list[SubmittedJob] = []
    submit_errors: list[str] = []

    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
        futures = [
            executor.submit(
                submit_upload_job,
                api_base,
                token,
                strategy_id,
                max(1, files_per_job),
                round_index,
                job_index,
            )
            for job_index in range(max(1, jobs_per_round))
        ]
        for future in as_completed(futures):
            try:
                submitted_jobs.append(future.result())
            except Exception as exc:  # pragma: no cover - diagnostics
                submit_errors.append(str(exc))

    submitted_jobs.sort(key=lambda item: item.job_id)
    job_ids = [job.job_id for job in submitted_jobs]
    final_jobs, unresolved_job_ids = poll_until_terminal(
        api_base,
        token,
        job_ids,
        timeout_seconds=max(1, poll_timeout_seconds),
        interval_seconds=max(0.2, poll_interval_seconds),
    )

    status_counts: dict[str, int] = {}
    for payload in final_jobs.values():
        status = str(payload.get("status", "unknown"))
        status_counts[status] = status_counts.get(status, 0) + 1

    create_latencies = [item.create_latency_ms for item in submitted_jobs]
    round_duration_seconds = round(time.monotonic() - round_started_at, 2)
    return {
        "round": round_index,
        "submitted_jobs": len(submitted_jobs),
        "submit_errors": submit_errors,
        "resolved_jobs": len(final_jobs),
        "unresolved_jobs": len(unresolved_job_ids),
        "unresolved_job_ids": unresolved_job_ids,
        "status_counts": status_counts,
        "create_latency_ms": {
            "min": min(create_latencies) if create_latencies else 0,
            "max": max(create_latencies) if create_latencies else 0,
            "avg": int(sum(create_latencies) / len(create_latencies)) if create_latencies else 0,
        },
        "duration_seconds": round_duration_seconds,
    }


def build_summary(
    *,
    api_base: str,
    strategy_id: str,
    rounds: list[dict[str, Any]],
    started_at: float,
    finished_at: float,
) -> dict[str, Any]:
    total_submitted = sum(round_data["submitted_jobs"] for round_data in rounds)
    total_resolved = sum(round_data["resolved_jobs"] for round_data in rounds)
    total_unresolved = sum(round_data["unresolved_jobs"] for round_data in rounds)
    total_submit_errors = sum(len(round_data["submit_errors"]) for round_data in rounds)

    total_status_counts: dict[str, int] = {}
    for round_data in rounds:
        for status, count in round_data["status_counts"].items():
            total_status_counts[status] = total_status_counts.get(status, 0) + int(count)

    duration_seconds = max(finished_at - started_at, 0.001)
    return {
        "api_base": api_base,
        "strategy_id": strategy_id,
        "round_count": len(rounds),
        "submitted_jobs": total_submitted,
        "resolved_jobs": total_resolved,
        "unresolved_jobs": total_unresolved,
        "submit_errors": total_submit_errors,
        "status_counts": total_status_counts,
        "throughput_jobs_per_second": round(total_submitted / duration_seconds, 2),
        "duration_seconds": round(duration_seconds, 2),
        "rounds": rounds,
    }


def main() -> int:
    args = parse_args()
    api_base = args.api_base.rstrip("/")
    token = login(api_base, args.username, args.password)

    started_at = time.monotonic()
    rounds: list[dict[str, Any]] = []
    for round_index in range(1, max(1, args.rounds) + 1):
        round_result = run_round(
            api_base=api_base,
            token=token,
            strategy_id=args.strategy_id,
            files_per_job=max(1, args.files_per_job),
            concurrency=max(1, args.concurrency),
            round_index=round_index,
            jobs_per_round=max(1, args.jobs_per_round),
            poll_timeout_seconds=max(1, args.poll_timeout_seconds),
            poll_interval_seconds=max(0.2, args.poll_interval_seconds),
        )
        rounds.append(round_result)
        if round_index < args.rounds:
            time.sleep(max(0.0, args.sleep_between_rounds_seconds))

    finished_at = time.monotonic()
    summary = build_summary(
        api_base=api_base,
        strategy_id=args.strategy_id,
        rounds=rounds,
        started_at=started_at,
        finished_at=finished_at,
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as output_file:
            json.dump(summary, output_file, ensure_ascii=False, indent=2)

    failed_jobs = summary["status_counts"].get("failed", 0)
    if summary["unresolved_jobs"] > max(0, args.max_unresolved):
        return 2
    if failed_jobs > max(0, args.max_failed):
        return 2
    if summary["submit_errors"] > 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
