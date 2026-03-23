import json
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import database_url
from app.models.job import Job
from app.models.task_record import TaskRecord
from app.schemas.dashboard import AnomalyCase, DashboardSummary, DashboardTrendPoint, StrategyUsagePoint


def get_dashboard_summary(
    db: Session,
    *,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> DashboardSummary:
    jobs = _list_jobs(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )
    records = _list_task_records(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )

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


def get_dashboard_trends(
    db: Session,
    *,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> list[DashboardTrendPoint]:
    jobs = _list_jobs(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
        order_asc=True,
    )
    grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"total_jobs": 0, "completed_jobs": 0})

    for job in jobs:
        if job.created_at is None:
            continue
        date_key = _ensure_aware(job.created_at).date().isoformat()
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


def get_dashboard_strategies(
    db: Session,
    *,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> list[StrategyUsagePoint]:
    records = _list_task_records(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )
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


def get_dashboard_anomalies(
    db: Session,
    *,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    limit: int = 10,
) -> list[AnomalyCase]:
    records = [
        record
        for record in _list_task_records(
            db,
            strategy_id=strategy_id,
            model_provider=model_provider,
            created_from=created_from,
            created_to=created_to,
        )
        if record.result_status != "completed" or record.feedback_status == "incorrect"
    ]

    return [
        AnomalyCase(
            record_id=record.id,
            strategy_name=record.strategy_name,
            summary=_build_anomaly_summary(record),
            created_at=_ensure_aware(record.created_at).isoformat() if record.created_at else "",
        )
        for record in records[:limit]
    ]


def _list_jobs(
    db: Session,
    *,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    order_asc: bool = False,
) -> list[Job]:
    stmt = select(Job)
    if strategy_id:
        stmt = stmt.where(Job.strategy_id == strategy_id)
    if model_provider:
        stmt = stmt.where(Job.model_provider == model_provider)
    if created_from:
        stmt = stmt.where(Job.created_at >= _ensure_aware_for_db(created_from))
    if created_to:
        stmt = stmt.where(Job.created_at <= _ensure_aware_for_db(created_to))

    if order_asc:
        stmt = stmt.order_by(Job.created_at.asc(), Job.id.asc())
    else:
        stmt = stmt.order_by(Job.created_at.desc(), Job.id.desc())
    return list(db.scalars(stmt))


def _list_task_records(
    db: Session,
    *,
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
) -> list[TaskRecord]:
    stmt = select(TaskRecord)
    if strategy_id:
        stmt = stmt.where(TaskRecord.strategy_id == strategy_id)
    if model_provider:
        stmt = stmt.where(TaskRecord.model_provider == model_provider)
    if created_from:
        stmt = stmt.where(TaskRecord.created_at >= _ensure_aware_for_db(created_from))
    if created_to:
        stmt = stmt.where(TaskRecord.created_at <= _ensure_aware_for_db(created_to))
    stmt = stmt.order_by(TaskRecord.created_at.desc(), TaskRecord.id.desc())
    return list(db.scalars(stmt))


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


def _ensure_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _ensure_aware_for_db(value: datetime) -> datetime:
    normalized = _ensure_aware(value)
    if database_url.get_backend_name().startswith("sqlite"):
        return normalized.replace(tzinfo=None)
    return normalized
