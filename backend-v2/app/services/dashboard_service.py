import json
from collections import defaultdict
from datetime import timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.task_record import TaskRecord
from app.schemas.dashboard import AnomalyCase, DashboardSummary, DashboardTrendPoint, StrategyUsagePoint


def get_dashboard_summary(db: Session) -> DashboardSummary:
    jobs = list(db.scalars(select(Job)))
    records = list(db.scalars(select(TaskRecord)))

    total_jobs = len(jobs)
    total_records = len(records)
    completed_jobs = sum(1 for job in jobs if job.status == "completed")
    structured_success_count = sum(
        1
        for record in records
        if record.result_status == "completed" and record.normalized_json is not None
    )
    reviewed_count = sum(1 for record in records if record.feedback_status != "unreviewed")
    pending_review_count = sum(1 for record in records if record.feedback_status == "unreviewed")
    confirmed_correct_count = sum(1 for record in records if record.feedback_status == "correct")
    anomaly_count = sum(
        1
        for record in records
        if record.result_status != "completed" or record.feedback_status == "incorrect"
    )

    return DashboardSummary(
        total_jobs=total_jobs,
        total_records=total_records,
        pending_review_count=pending_review_count,
        success_rate=_safe_rate(completed_jobs, total_jobs),
        anomaly_rate=_safe_rate(anomaly_count, total_records),
        structured_success_rate=_safe_rate(structured_success_count, total_records),
        reviewed_rate=_safe_rate(reviewed_count, total_records),
        confirmed_accuracy_rate=_safe_rate(confirmed_correct_count, reviewed_count),
    )


def get_dashboard_trends(db: Session) -> list[DashboardTrendPoint]:
    jobs = list(db.scalars(select(Job).order_by(Job.created_at.asc(), Job.id.asc())))
    grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"total_jobs": 0, "completed_jobs": 0})

    for job in jobs:
        if job.created_at is None:
            continue
        date_key = job.created_at.astimezone(timezone.utc).date().isoformat()
        grouped[date_key]["total_jobs"] += 1
        if job.status == "completed":
            grouped[date_key]["completed_jobs"] += 1

    return [
        DashboardTrendPoint(
            date=date_key,
            total_jobs=values["total_jobs"],
            success_rate=_safe_rate(values["completed_jobs"], values["total_jobs"]),
        )
        for date_key, values in sorted(grouped.items(), key=lambda item: item[0])
    ]


def get_dashboard_strategies(db: Session) -> list[StrategyUsagePoint]:
    records = list(db.scalars(select(TaskRecord)))
    grouped: dict[tuple[str, str], int] = defaultdict(int)

    for record in records:
        grouped[(record.strategy_id, record.strategy_name)] += 1

    ranked = sorted(grouped.items(), key=lambda item: (-item[1], item[0][1]))
    return [
        StrategyUsagePoint(
            strategy_id=strategy_id,
            strategy_name=strategy_name,
            usage_count=usage_count,
        )
        for (strategy_id, strategy_name), usage_count in ranked
    ]


def get_dashboard_anomalies(db: Session, *, limit: int = 10) -> list[AnomalyCase]:
    stmt = select(TaskRecord).order_by(TaskRecord.created_at.desc(), TaskRecord.id.desc())
    records = [
        record
        for record in db.scalars(stmt)
        if record.result_status != "completed" or record.feedback_status == "incorrect"
    ]

    return [
        AnomalyCase(
            record_id=record.id,
            strategy_name=record.strategy_name,
            summary=_build_anomaly_summary(record),
            created_at=record.created_at.astimezone(timezone.utc).isoformat() if record.created_at else "",
        )
        for record in records[:limit]
    ]


def _build_anomaly_summary(record: TaskRecord) -> str:
    if isinstance(record.normalized_json, dict):
        summary = record.normalized_json.get("summary")
        if isinstance(summary, str) and summary.strip():
            return summary.strip()[:120]
        return json.dumps(record.normalized_json, ensure_ascii=False)[:120]

    if record.raw_model_response:
        return record.raw_model_response.strip()[:120]

    return "No summary available"


def _safe_rate(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)
