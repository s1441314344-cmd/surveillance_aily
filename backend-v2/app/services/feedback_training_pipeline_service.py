from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, object_session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.feedback_training import (
    FeedbackReleaseRequest,
    FeedbackTrainingCandidate,
    FeedbackTrainingConfig,
    FeedbackTrainingDataset,
    FeedbackTrainingRun,
)
from app.models.task_record import PredictionFeedback, TaskRecord
from app.schemas.training import (
    TrainingConfigRead,
    TrainingDatasetRead,
    TrainingHistoryRead,
    TrainingConfigUpdate,
    TrainingOverviewRead,
    TrainingPipelineRunRead,
    TrainingRunDetailRead,
    TrainingRunRead,
    TrainingRunReviewRead,
)
from app.services.ids import generate_id
from app.services.model_call_log_service import build_model_call_details, create_model_call_log
from app.services.model_evaluation_service import (
    EvaluationTarget,
    evaluate_model_targets,
    save_evaluation_markdown_report,
    save_evaluation_report,
)
from app.services.strategy_service import get_strategy_or_404, record_strategy_version

settings = get_settings()

REVIEWED_STATUSES = {"correct", "incorrect"}
RUN_STATUS_RUNNING = "running"
RUN_STATUS_COMPLETED = "completed"
RUN_STATUS_FAILED = "failed"
RELEASE_STATUS_PENDING = "pending"
RELEASE_STATUS_APPROVED = "approved"
RELEASE_STATUS_REJECTED = "rejected"
TRAINING_ROUTE_FINETUNE = "finetune"
TRAINING_ROUTE_PROMPT_ENHANCE = "prompt_enhance"
SUPPORTED_FINETUNE_PROVIDERS = {"openai"}
TRAINING_CONFIG_DEFAULT_ID = "default"


@dataclass
class ReviewedSample:
    record: TaskRecord
    feedback: PredictionFeedback
    candidate: FeedbackTrainingCandidate | None = None


@dataclass
class SampleSelectionResult:
    selected: list[ReviewedSample]
    reviewed_total: int
    already_reflowed_count: int
    included_after_reflow_filter: int


def get_training_overview(db: Session, *, provider: str | None = None) -> TrainingOverviewRead:
    reviewed_stmt = select(func.count(TaskRecord.id)).where(TaskRecord.feedback_status.in_(tuple(REVIEWED_STATUSES)))
    candidate_stmt = select(func.count(FeedbackTrainingCandidate.id))
    pending_stmt = select(func.count(FeedbackReleaseRequest.id)).where(FeedbackReleaseRequest.status == RELEASE_STATUS_PENDING)
    last_run_stmt = select(FeedbackTrainingRun).order_by(
        FeedbackTrainingRun.created_at.desc(),
        FeedbackTrainingRun.id.desc(),
    )

    normalized_provider = (provider or "").strip().lower() or None
    if normalized_provider:
        reviewed_stmt = reviewed_stmt.where(TaskRecord.model_provider == normalized_provider)
        candidate_stmt = candidate_stmt.where(FeedbackTrainingCandidate.model_provider == normalized_provider)
        run_ids_for_provider = select(FeedbackTrainingRun.id).where(FeedbackTrainingRun.model_provider == normalized_provider)
        pending_stmt = pending_stmt.where(FeedbackReleaseRequest.run_id.in_(run_ids_for_provider))
        last_run_stmt = last_run_stmt.where(FeedbackTrainingRun.model_provider == normalized_provider)

    reviewed_samples = int(db.scalar(reviewed_stmt) or 0)
    candidate_samples = int(db.scalar(candidate_stmt) or 0)
    pending_release_requests = int(db.scalar(pending_stmt) or 0)
    last_run = db.scalar(last_run_stmt)

    return TrainingOverviewRead(
        reviewed_samples=reviewed_samples,
        candidate_samples=candidate_samples,
        pending_release_requests=pending_release_requests,
        last_run_id=last_run.id if last_run else None,
        last_run_status=last_run.status if last_run else None,
        last_run_at=_serialize_datetime(last_run.created_at) if last_run else None,
        last_error=last_run.error_message if last_run and last_run.status == RUN_STATUS_FAILED else None,
    )


def get_training_config(db: Session) -> TrainingConfigRead:
    config = _get_or_create_training_config(db)
    return TrainingConfigRead(min_samples=int(config.min_samples))


def update_training_config(db: Session, payload: TrainingConfigUpdate) -> TrainingConfigRead:
    min_samples = int(payload.min_samples)
    if min_samples < 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="min_samples must be >= 1")
    if min_samples > 10000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="min_samples must be <= 10000")

    config = _get_or_create_training_config(db)
    config.min_samples = min_samples
    db.commit()
    return TrainingConfigRead(min_samples=int(config.min_samples))


def list_training_datasets(
    db: Session,
    *,
    provider: str | None = None,
    strategy_id: str | None = None,
    limit: int = 100,
) -> list[TrainingDatasetRead]:
    safe_limit = min(max(int(limit or 100), 1), 500)
    stmt = select(FeedbackTrainingDataset).order_by(
        FeedbackTrainingDataset.created_at.desc(),
        FeedbackTrainingDataset.id.desc(),
    ).limit(safe_limit)
    if provider:
        stmt = stmt.where(FeedbackTrainingDataset.model_provider == provider.strip().lower())
    if strategy_id:
        stmt = stmt.where(FeedbackTrainingDataset.strategy_id == strategy_id)
    datasets = list(db.scalars(stmt))
    return [_serialize_dataset(item) for item in datasets]


def list_training_runs(
    db: Session,
    *,
    provider: str | None = None,
    strategy_id: str | None = None,
    status_filter: str | None = None,
    limit: int = 100,
) -> list[TrainingRunRead]:
    safe_limit = min(max(int(limit or 100), 1), 500)
    stmt = select(FeedbackTrainingRun).order_by(
        FeedbackTrainingRun.created_at.desc(),
        FeedbackTrainingRun.id.desc(),
    ).limit(safe_limit)
    if provider:
        stmt = stmt.where(FeedbackTrainingRun.model_provider == provider.strip().lower())
    if strategy_id:
        stmt = stmt.where(FeedbackTrainingRun.strategy_id == strategy_id)
    if status_filter:
        stmt = stmt.where(FeedbackTrainingRun.status == status_filter)

    runs = list(db.scalars(stmt))
    dataset_map = _build_dataset_map(db, [run.dataset_id for run in runs])
    release_map = _build_release_map(db, [run.id for run in runs])
    return [_serialize_run(run, dataset_map=dataset_map, release_map=release_map) for run in runs]


def list_training_history(
    db: Session,
    *,
    provider: str | None = None,
    strategy_id: str | None = None,
    limit: int = 100,
) -> list[TrainingHistoryRead]:
    _sync_candidate_reflow_history_from_runs(db)
    safe_limit = min(max(int(limit or 100), 1), 500)
    stmt = (
        select(FeedbackTrainingCandidate)
        .where(FeedbackTrainingCandidate.is_reflowed.is_(True))
        .order_by(
            FeedbackTrainingCandidate.reflowed_at.desc(),
            FeedbackTrainingCandidate.updated_at.desc(),
            FeedbackTrainingCandidate.id.desc(),
        )
        .limit(safe_limit)
    )
    if provider:
        stmt = stmt.where(FeedbackTrainingCandidate.model_provider == provider.strip().lower())
    if strategy_id:
        stmt = stmt.where(FeedbackTrainingCandidate.strategy_id == strategy_id)
    candidates = list(db.scalars(stmt))
    return [_serialize_history_item(item) for item in candidates]


def get_training_run_detail_or_404(db: Session, run_id: str) -> TrainingRunDetailRead:
    run = db.get(FeedbackTrainingRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training run not found")

    dataset = db.get(FeedbackTrainingDataset, run.dataset_id)
    release_request = db.scalar(select(FeedbackReleaseRequest).where(FeedbackReleaseRequest.run_id == run.id))
    base = _serialize_run(
        run,
        dataset_map={dataset.id: dataset} if dataset else {},
        release_map={run.id: release_request} if release_request else {},
    )
    return TrainingRunDetailRead(
        **base.model_dump(),
        candidate_snapshot=run.candidate_snapshot,
        evaluation_report_path=run.evaluation_report_path,
        release_request=_serialize_release_request_payload(release_request),
    )


def approve_training_run(
    db: Session,
    *,
    run_id: str,
    reviewer: str,
    comment: str | None = None,
) -> TrainingRunReviewRead:
    run = db.get(FeedbackTrainingRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training run not found")
    if run.status != RUN_STATUS_COMPLETED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only completed runs can be approved")

    release_request = _get_pending_release_request_or_409(db, run_id)
    strategy = get_strategy_or_404(db, run.strategy_id)
    candidate_snapshot = run.candidate_snapshot or {}
    publish_payload: dict = {}

    if run.route_actual == TRAINING_ROUTE_PROMPT_ENHANCE:
        enhanced_prompt = str(candidate_snapshot.get("enhanced_prompt") or "").strip()
        if not enhanced_prompt:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Candidate snapshot missing enhanced prompt")
        if strategy.prompt_template != enhanced_prompt:
            strategy.prompt_template = enhanced_prompt
            strategy.version += 1
            record_strategy_version(db, strategy)
        publish_payload = {
            "mode": TRAINING_ROUTE_PROMPT_ENHANCE,
            "strategy_version": strategy.version,
            "prompt_preview": enhanced_prompt[:500],
        }
    elif run.route_actual == TRAINING_ROUTE_FINETUNE:
        candidate_model_name = str(candidate_snapshot.get("candidate_model_name") or run.candidate_version or "").strip()
        if not candidate_model_name:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Candidate model name is missing")
        if strategy.model_name != candidate_model_name:
            strategy.model_name = candidate_model_name
            strategy.version += 1
            record_strategy_version(db, strategy)
        publish_payload = {
            "mode": TRAINING_ROUTE_FINETUNE,
            "strategy_version": strategy.version,
            "model_name": strategy.model_name,
        }
    else:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Unsupported release route: {run.route_actual}")

    release_request.status = RELEASE_STATUS_APPROVED
    release_request.reviewer = reviewer
    release_request.reviewed_at = _utcnow()
    release_request.review_comment = comment
    release_request.release_payload = publish_payload
    release_request.is_published = True

    create_model_call_log(
        db,
        provider=run.model_provider,
        model_name=run.candidate_version or run.baseline_model_name,
        trigger_type="feedback_release",
        trigger_source="training_approve",
        response_format="system",
        success=True,
        strategy_id=run.strategy_id,
        details=build_model_call_details(
            input_summary={"run_id": run.id, "route_actual": run.route_actual},
            context={"status": release_request.status, "reviewer": reviewer},
        ),
    )
    db.commit()
    return TrainingRunReviewRead(
        run_id=run.id,
        release_request_id=release_request.id,
        status=release_request.status,
        reviewed_at=_serialize_datetime(release_request.reviewed_at),
        reviewer=release_request.reviewer,
        comment=release_request.review_comment,
    )


def reject_training_run(
    db: Session,
    *,
    run_id: str,
    reviewer: str,
    comment: str | None = None,
) -> TrainingRunReviewRead:
    run = db.get(FeedbackTrainingRun, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training run not found")

    release_request = _get_pending_release_request_or_409(db, run_id)
    release_request.status = RELEASE_STATUS_REJECTED
    release_request.reviewer = reviewer
    release_request.reviewed_at = _utcnow()
    release_request.review_comment = comment
    release_request.release_payload = None
    release_request.is_published = False

    create_model_call_log(
        db,
        provider=run.model_provider,
        model_name=run.candidate_version or run.baseline_model_name,
        trigger_type="feedback_release",
        trigger_source="training_reject",
        response_format="system",
        success=True,
        strategy_id=run.strategy_id,
        details=build_model_call_details(
            input_summary={"run_id": run.id, "route_actual": run.route_actual},
            context={"status": release_request.status, "reviewer": reviewer},
        ),
    )
    db.commit()
    return TrainingRunReviewRead(
        run_id=run.id,
        release_request_id=release_request.id,
        status=release_request.status,
        reviewed_at=_serialize_datetime(release_request.reviewed_at),
        reviewer=release_request.reviewer,
        comment=release_request.review_comment,
    )


def run_feedback_training_pipeline_once(
    *,
    strategy_id: str | None = None,
    trigger_source: str = "scheduler",
    triggered_by: str = "scheduler",
) -> TrainingPipelineRunRead:
    with SessionLocal() as db:
        return run_feedback_training_pipeline(
            db,
            strategy_id=strategy_id,
            trigger_source=trigger_source,
            triggered_by=triggered_by,
        )


def run_feedback_training_pipeline(
    db: Session,
    *,
    strategy_id: str | None = None,
    trigger_source: str,
    triggered_by: str,
) -> TrainingPipelineRunRead:
    _sync_candidate_reflow_history_from_runs(db)
    config = _get_or_create_training_config(db)
    min_samples = int(config.min_samples or settings.feedback_training_min_samples or 30)
    grouped = _collect_reviewed_samples_by_strategy(db, strategy_id=strategy_id)
    dataset_ids: list[str] = []
    run_ids: list[str] = []
    skipped: list[dict] = []

    if not grouped:
        return TrainingPipelineRunRead(
            trigger_source=trigger_source,
            triggered_by=triggered_by,
            strategy_id=strategy_id,
            dataset_ids=[],
            run_ids=[],
            skipped=[{"reason": "no_reviewed_samples"}],
        )

    for group_strategy_id, samples in grouped.items():
        strategy = get_strategy_or_404(db, group_strategy_id)
        selection = _select_training_samples_for_strategy(strategy.id, samples)
        selected_samples = selection.selected
        _upsert_training_candidates(db, samples=samples)
        db.commit()

        if selection.included_after_reflow_filter == 0 and selection.already_reflowed_count > 0:
            skipped.append(
                {
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "reason": "already_reflowed",
                    "reviewed_count": selection.reviewed_total,
                    "already_reflowed_count": selection.already_reflowed_count,
                }
            )
            continue

        if not selected_samples:
            skipped.append(
                {
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "reason": "insufficient_samples_after_sampling",
                }
            )
            continue

        if len(selected_samples) < min_samples:
            skipped.append(
                {
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "reason": "insufficient_samples",
                    "sample_count": len(selected_samples),
                    "min_samples": min_samples,
                }
            )
            continue

        dataset = _build_dataset(
            db,
            strategy=strategy,
            selected_samples=selected_samples,
            trigger_source=trigger_source,
            triggered_by=triggered_by,
        )
        dataset_ids.append(dataset.id)
        db.commit()

        run = _create_training_run(
            db,
            dataset=dataset,
            strategy=strategy,
            selected_samples=selected_samples,
            trigger_source=trigger_source,
            triggered_by=triggered_by,
        )
        run_ids.append(run.id)
        db.commit()

    return TrainingPipelineRunRead(
        trigger_source=trigger_source,
        triggered_by=triggered_by,
        strategy_id=strategy_id,
        dataset_ids=dataset_ids,
        run_ids=run_ids,
        skipped=skipped,
    )


def _collect_reviewed_samples_by_strategy(
    db: Session,
    *,
    strategy_id: str | None,
) -> dict[str, list[ReviewedSample]]:
    stmt = (
        select(TaskRecord, PredictionFeedback, FeedbackTrainingCandidate)
        .join(PredictionFeedback, PredictionFeedback.record_id == TaskRecord.id)
        .outerjoin(FeedbackTrainingCandidate, FeedbackTrainingCandidate.record_id == TaskRecord.id)
        .where(TaskRecord.feedback_status.in_(tuple(REVIEWED_STATUSES)))
        .order_by(TaskRecord.created_at.desc(), TaskRecord.id.desc())
    )
    if strategy_id:
        stmt = stmt.where(TaskRecord.strategy_id == strategy_id)

    grouped: dict[str, list[ReviewedSample]] = {}
    for record, feedback, candidate in db.execute(stmt):
        grouped.setdefault(record.strategy_id, []).append(
            ReviewedSample(record=record, feedback=feedback, candidate=candidate)
        )
    return grouped


def _select_training_samples_for_strategy(strategy_id: str, samples: list[ReviewedSample]) -> SampleSelectionResult:
    eligible = [
        item
        for item in samples
        if not (item.candidate is not None and bool(item.candidate.is_reflowed))
    ]
    incorrect = [item for item in eligible if item.feedback.judgement == "incorrect"]
    correct = [item for item in eligible if item.feedback.judgement == "correct"]

    ratio = float(settings.feedback_training_positive_ratio or 1.0)
    ratio = max(ratio, 0.0)
    required_correct = math.ceil(len(incorrect) * ratio) if incorrect else len(correct)
    selected_correct = correct

    if required_correct < len(correct):
        seed = f"{strategy_id}:{len(samples)}:{len(correct)}:{len(incorrect)}"
        randomizer = random.Random(seed)
        selected_correct = randomizer.sample(correct, required_correct)

    selected: list[ReviewedSample] = incorrect + selected_correct
    max_samples = int(settings.feedback_training_max_samples_per_strategy or 2000)
    if len(selected) > max_samples:
        selected = selected[:max_samples]
    return SampleSelectionResult(
        selected=selected,
        reviewed_total=len(samples),
        already_reflowed_count=len(samples) - len(eligible),
        included_after_reflow_filter=len(eligible),
    )


def _upsert_training_candidates(
    db: Session,
    *,
    samples: list[ReviewedSample],
) -> None:
    for sample in samples:
        payload = _build_candidate_payload(sample)
        candidate = db.scalar(
            select(FeedbackTrainingCandidate).where(FeedbackTrainingCandidate.record_id == sample.record.id)
        )
        if candidate is None:
            candidate = FeedbackTrainingCandidate(
                id=generate_id(),
                record_id=sample.record.id,
                feedback_id=sample.feedback.id,
                strategy_id=sample.record.strategy_id,
                strategy_name=sample.record.strategy_name,
                judgement=sample.feedback.judgement,
                corrected_label=sample.feedback.corrected_label,
                comment=sample.feedback.comment,
                reviewer=sample.feedback.reviewer,
                input_image_path=sample.record.input_image_path,
                model_provider=sample.record.model_provider,
                model_name=sample.record.model_name,
                strategy_snapshot=sample.record.strategy_snapshot,
                source_created_at=sample.record.created_at,
                sample_payload=payload,
            )
            db.add(candidate)
            continue

        if candidate.is_reflowed:
            continue

        candidate.feedback_id = sample.feedback.id
        candidate.strategy_id = sample.record.strategy_id
        candidate.strategy_name = sample.record.strategy_name
        candidate.judgement = sample.feedback.judgement
        candidate.corrected_label = sample.feedback.corrected_label
        candidate.comment = sample.feedback.comment
        candidate.reviewer = sample.feedback.reviewer
        candidate.input_image_path = sample.record.input_image_path
        candidate.model_provider = sample.record.model_provider
        candidate.model_name = sample.record.model_name
        candidate.strategy_snapshot = sample.record.strategy_snapshot
        candidate.source_created_at = sample.record.created_at
        candidate.sample_payload = payload


def _build_dataset(
    db: Session,
    *,
    strategy,
    selected_samples: list[ReviewedSample],
    trigger_source: str,
    triggered_by: str,
) -> FeedbackTrainingDataset:
    dataset_id = generate_id()
    dataset_dir = _feedback_training_root_dir() / "datasets"
    dataset_dir.mkdir(parents=True, exist_ok=True)
    dataset_path = dataset_dir / f"{dataset_id}.json"

    schema = strategy.response_schema if isinstance(strategy.response_schema, dict) else {}
    prompt_template = strategy.prompt_template
    payload_samples: list[dict] = []
    incorrect_count = 0
    correct_count = 0
    sample_manifest: list[dict] = []
    for item in selected_samples:
        if item.feedback.judgement == "incorrect":
            incorrect_count += 1
        else:
            correct_count += 1

        expected_json, compare_fields = _build_expected_json(item.feedback, schema)
        payload_samples.append(
            {
                "sample_id": item.record.id,
                "image_path": item.record.input_image_path,
                "prompt": prompt_template,
                "response_schema": schema,
                "expected_json": expected_json,
                "compare_fields": compare_fields,
                "tags": [item.feedback.judgement],
            }
        )
        sample_manifest.append(
            {
                "record_id": item.record.id,
                "feedback_id": item.feedback.id,
                "judgement": item.feedback.judgement,
            }
        )

    dataset_payload = {
        "version": "feedback-training-v1",
        "strategy_id": strategy.id,
        "strategy_name": strategy.name,
        "samples": payload_samples,
    }
    dataset_path.write_text(json.dumps(dataset_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    dataset = FeedbackTrainingDataset(
        id=dataset_id,
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        model_provider=strategy.model_provider,
        model_name=strategy.model_name,
        sample_count=len(payload_samples),
        incorrect_count=incorrect_count,
        correct_count=correct_count,
        positive_ratio=float(settings.feedback_training_positive_ratio or 1.0),
        sample_manifest={"samples": sample_manifest},
        dataset_path=str(dataset_path),
        status="ready",
        built_by=triggered_by,
        trigger_source=trigger_source,
    )
    db.add(dataset)

    create_model_call_log(
        db,
        provider=strategy.model_provider,
        model_name=strategy.model_name,
        trigger_type="feedback_dataset_build",
        trigger_source=trigger_source,
        response_format="system",
        success=True,
        strategy_id=strategy.id,
        details=build_model_call_details(
            input_summary={
                "dataset_id": dataset.id,
                "sample_count": dataset.sample_count,
                "incorrect_count": dataset.incorrect_count,
                "correct_count": dataset.correct_count,
            },
            context={"dataset_path": str(dataset_path)},
        ),
    )
    return dataset


def _create_training_run(
    db: Session,
    *,
    dataset: FeedbackTrainingDataset,
    strategy,
    selected_samples: list[ReviewedSample],
    trigger_source: str,
    triggered_by: str,
) -> FeedbackTrainingRun:
    requested_route = (settings.feedback_training_route_default or TRAINING_ROUTE_FINETUNE).strip().lower()
    if requested_route not in {TRAINING_ROUTE_FINETUNE, TRAINING_ROUTE_PROMPT_ENHANCE}:
        requested_route = TRAINING_ROUTE_FINETUNE
    route_actual = _resolve_training_route(requested_route, strategy.model_provider)
    run = FeedbackTrainingRun(
        id=generate_id(),
        dataset_id=dataset.id,
        strategy_id=strategy.id,
        strategy_name=strategy.name,
        model_provider=strategy.model_provider,
        baseline_model_name=strategy.model_name,
        route_requested=requested_route,
        route_actual=route_actual,
        status=RUN_STATUS_RUNNING,
        candidate_version=None,
        candidate_snapshot=None,
        evaluation_summary=None,
        evaluation_report_path=None,
        error_message=None,
        sample_count=dataset.sample_count,
        started_at=_utcnow(),
        finished_at=None,
        triggered_by=triggered_by,
        trigger_source=trigger_source,
    )
    db.add(run)
    db.flush()

    try:
        training_result = _run_training_route(
            route_actual=route_actual,
            run=run,
            strategy=strategy,
            dataset=dataset,
        )
        run.candidate_version = training_result["candidate_version"]
        run.candidate_snapshot = training_result["candidate_snapshot"]

        evaluation_result = _run_offline_evaluation(
            run=run,
            strategy=strategy,
            dataset=dataset,
            candidate_snapshot=run.candidate_snapshot or {},
            route_actual=route_actual,
        )

        run.evaluation_summary = evaluation_result.get("summary")
        run.evaluation_report_path = evaluation_result.get("report_path")
        run.status = RUN_STATUS_COMPLETED
        run.finished_at = _utcnow()
        run.error_message = None

        release_request = FeedbackReleaseRequest(
            id=generate_id(),
            run_id=run.id,
            strategy_id=run.strategy_id,
            candidate_version=run.candidate_version or run.baseline_model_name,
            status=RELEASE_STATUS_PENDING,
            requested_by=triggered_by,
            reviewer=None,
            reviewed_at=None,
            review_comment=None,
            release_payload=None,
            is_published=False,
        )
        db.add(release_request)
        dataset.status = "used"
        _mark_training_samples_reflowed(
            db,
            run_id=run.id,
            dataset_id=dataset.id,
            selected_samples=selected_samples,
        )
    except Exception as exc:  # pragma: no cover
        run.status = RUN_STATUS_FAILED
        run.finished_at = _utcnow()
        run.error_message = str(exc)
        dataset.status = "failed"

    return run


def _mark_training_samples_reflowed(
    db: Session,
    *,
    run_id: str,
    dataset_id: str,
    selected_samples: list[ReviewedSample],
) -> None:
    now = _utcnow()
    for sample in selected_samples:
        candidate = db.scalar(
            select(FeedbackTrainingCandidate).where(FeedbackTrainingCandidate.record_id == sample.record.id)
        )
        if candidate is None:
            continue
        candidate.is_reflowed = True
        candidate.reflowed_at = now
        candidate.reflow_run_id = run_id
        candidate.reflow_dataset_id = dataset_id


def _sync_candidate_reflow_history_from_runs(db: Session) -> None:
    completed_runs = list(
        db.scalars(
            select(FeedbackTrainingRun)
            .where(FeedbackTrainingRun.status == RUN_STATUS_COMPLETED)
            .order_by(FeedbackTrainingRun.created_at.desc(), FeedbackTrainingRun.id.desc())
        )
    )
    if not completed_runs:
        return

    run_by_dataset: dict[str, FeedbackTrainingRun] = {}
    for run in completed_runs:
        if run.dataset_id and run.dataset_id not in run_by_dataset:
            run_by_dataset[run.dataset_id] = run
    if not run_by_dataset:
        return

    datasets = list(
        db.scalars(select(FeedbackTrainingDataset).where(FeedbackTrainingDataset.id.in_(list(run_by_dataset.keys()))))
    )
    if not datasets:
        return

    touched = False
    for dataset in datasets:
        run = run_by_dataset.get(dataset.id)
        if run is None:
            continue
        samples = ((dataset.sample_manifest or {}).get("samples") or []) if dataset.sample_manifest else []
        if not isinstance(samples, list):
            continue
        for item in samples:
            if not isinstance(item, dict):
                continue
            record_id = str(item.get("record_id") or "").strip()
            if not record_id:
                continue
            candidate = db.scalar(
                select(FeedbackTrainingCandidate).where(FeedbackTrainingCandidate.record_id == record_id)
            )
            if candidate is None:
                continue
            if candidate.is_reflowed and candidate.reflow_run_id and candidate.reflow_dataset_id:
                continue
            candidate.is_reflowed = True
            candidate.reflowed_at = run.finished_at or run.created_at
            candidate.reflow_run_id = run.id
            candidate.reflow_dataset_id = dataset.id
            touched = True

    if touched:
        db.commit()


def _get_or_create_training_config(db: Session) -> FeedbackTrainingConfig:
    config = db.get(FeedbackTrainingConfig, TRAINING_CONFIG_DEFAULT_ID)
    if config is not None:
        return config
    fallback = int(settings.feedback_training_min_samples or 30)
    if fallback < 1:
        fallback = 1
    config = FeedbackTrainingConfig(id=TRAINING_CONFIG_DEFAULT_ID, min_samples=fallback)
    db.add(config)
    db.commit()
    return config


def _run_training_route(
    *,
    route_actual: str,
    run: FeedbackTrainingRun,
    strategy,
    dataset: FeedbackTrainingDataset,
) -> dict:
    if route_actual == TRAINING_ROUTE_PROMPT_ENHANCE:
        return _build_prompt_enhance_candidate(run=run, strategy=strategy, dataset=dataset)
    if route_actual == TRAINING_ROUTE_FINETUNE:
        return _build_finetune_candidate(run=run, strategy=strategy, dataset=dataset)
    raise RuntimeError(f"Unsupported training route: {route_actual}")


def _build_prompt_enhance_candidate(*, run: FeedbackTrainingRun, strategy, dataset: FeedbackTrainingDataset) -> dict:
    dataset_payload = json.loads(Path(dataset.dataset_path).read_text(encoding="utf-8"))
    sample_hints: list[str] = []
    for item in (dataset_payload.get("samples") or [])[:5]:
        sample_id = str(item.get("sample_id") or "")
        expected_json = item.get("expected_json")
        sample_hints.append(f"- 样本[{sample_id}] 人工标注：{json.dumps(expected_json, ensure_ascii=False)}")

    hint_block = "\n".join(sample_hints) if sample_hints else "- 无可用样本提示"
    enhanced_prompt = (
        f"{strategy.prompt_template}\n\n"
        "【反馈回流增强】请优先参考以下近期人工复核样本，提升对已出现误判场景的识别稳定性：\n"
        f"{hint_block}\n"
    )
    candidate_version = f"prompt-v{strategy.version + 1}-{run.id[:8]}"
    candidate_snapshot = {
        "mode": TRAINING_ROUTE_PROMPT_ENHANCE,
        "dataset_id": dataset.id,
        "enhanced_prompt": enhanced_prompt,
        "hint_count": len(sample_hints),
    }
    db = _require_session(run)
    create_model_call_log(
        db,
        provider=run.model_provider,
        model_name=run.baseline_model_name,
        trigger_type="feedback_training",
        trigger_source=run.trigger_source,
        response_format="system",
        success=True,
        strategy_id=run.strategy_id,
        details=build_model_call_details(
            input_summary={
                "run_id": run.id,
                "route_requested": run.route_requested,
                "route_actual": run.route_actual,
                "dataset_id": dataset.id,
                "sample_count": dataset.sample_count,
            },
            context={"candidate_version": candidate_version},
        ),
    )
    return {
        "candidate_version": candidate_version,
        "candidate_snapshot": candidate_snapshot,
    }


def _build_finetune_candidate(*, run: FeedbackTrainingRun, strategy, dataset: FeedbackTrainingDataset) -> dict:
    candidate_model_name = f"ft-{strategy.model_name}-{run.id[:8]}"
    candidate_snapshot = {
        "mode": TRAINING_ROUTE_FINETUNE,
        "dataset_id": dataset.id,
        "candidate_model_name": candidate_model_name,
        "note": "placeholder_finetune_result",
    }
    db = _require_session(run)
    create_model_call_log(
        db,
        provider=run.model_provider,
        model_name=candidate_model_name,
        trigger_type="feedback_training",
        trigger_source=run.trigger_source,
        response_format="system",
        success=True,
        strategy_id=run.strategy_id,
        details=build_model_call_details(
            input_summary={
                "run_id": run.id,
                "route_requested": run.route_requested,
                "route_actual": run.route_actual,
                "dataset_id": dataset.id,
                "sample_count": dataset.sample_count,
            },
            context={"candidate_model_name": candidate_model_name},
        ),
    )
    return {
        "candidate_version": candidate_model_name,
        "candidate_snapshot": candidate_snapshot,
    }


def _run_offline_evaluation(
    *,
    run: FeedbackTrainingRun,
    strategy,
    dataset: FeedbackTrainingDataset,
    candidate_snapshot: dict,
    route_actual: str,
) -> dict:
    evaluation_dataset_path = Path(dataset.dataset_path)
    if route_actual == TRAINING_ROUTE_PROMPT_ENHANCE:
        enhanced_prompt = str(candidate_snapshot.get("enhanced_prompt") or "").strip()
        if enhanced_prompt:
            payload = json.loads(evaluation_dataset_path.read_text(encoding="utf-8"))
            for item in payload.get("samples") or []:
                item["prompt"] = enhanced_prompt
            prompt_dataset_path = evaluation_dataset_path.with_name(f"{evaluation_dataset_path.stem}.prompt.json")
            prompt_dataset_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            evaluation_dataset_path = prompt_dataset_path

    targets: list[EvaluationTarget] = []
    if route_actual == TRAINING_ROUTE_FINETUNE:
        candidate_model = str(candidate_snapshot.get("candidate_model_name") or "").strip()
        if candidate_model:
            targets.append(EvaluationTarget(provider=strategy.model_provider, model=candidate_model))
    if not targets:
        targets.append(EvaluationTarget(provider=strategy.model_provider, model=strategy.model_name))

    report = evaluate_model_targets(
        dataset_path=evaluation_dataset_path,
        targets=targets,
        repeats=1,
        max_workers=1,
        pricing_table={},
    )

    reports_dir = _feedback_training_root_dir() / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_path = save_evaluation_report(report, reports_dir / f"{run.id}.json")
    save_evaluation_markdown_report(report, reports_dir / f"{run.id}.md")

    summary = {}
    if report.summaries:
        selected = report.summaries[0]
        summary = {
            "target": selected.target,
            "request_success_rate": selected.request_success_rate,
            "structured_success_rate": selected.structured_success_rate,
            "accuracy_rate": selected.accuracy_rate,
            "average_latency_ms": selected.average_latency_ms,
            "total_runs": selected.total_runs,
        }

    db = _require_session(run)
    create_model_call_log(
        db,
        provider=run.model_provider,
        model_name=run.candidate_version or run.baseline_model_name,
        trigger_type="feedback_evaluation",
        trigger_source=run.trigger_source,
        response_format="system",
        success=True,
        strategy_id=run.strategy_id,
        details=build_model_call_details(
            input_summary={"run_id": run.id, "dataset_id": dataset.id},
            context={"report_path": str(report_path), "summary": summary},
        ),
    )
    return {
        "summary": summary,
        "report_path": str(report_path),
    }


def _build_expected_json(feedback: PredictionFeedback, response_schema: dict) -> tuple[dict, list[str]]:
    corrected = (feedback.corrected_label or "").strip()
    expected_json: dict = {}
    if corrected:
        try:
            parsed = json.loads(corrected)
            expected_json = parsed if isinstance(parsed, dict) else {"corrected_label": corrected}
        except Exception:
            expected_json = {"corrected_label": corrected}
    else:
        expected_json = {"judgement": feedback.judgement}

    schema_properties = set(((response_schema or {}).get("properties") or {}).keys())
    compare_fields = [key for key in expected_json.keys() if key in schema_properties]
    return expected_json, compare_fields


def _build_candidate_payload(sample: ReviewedSample) -> dict:
    return {
        "record_id": sample.record.id,
        "job_id": sample.record.job_id,
        "strategy_id": sample.record.strategy_id,
        "input_image_path": sample.record.input_image_path,
        "judgement": sample.feedback.judgement,
        "corrected_label": sample.feedback.corrected_label,
        "comment": sample.feedback.comment,
    }


def _resolve_training_route(requested_route: str, provider: str) -> str:
    normalized_provider = (provider or "").strip().lower()
    if requested_route == TRAINING_ROUTE_FINETUNE and normalized_provider not in SUPPORTED_FINETUNE_PROVIDERS:
        return TRAINING_ROUTE_PROMPT_ENHANCE
    return requested_route


def _get_pending_release_request_or_409(db: Session, run_id: str) -> FeedbackReleaseRequest:
    request = db.scalar(select(FeedbackReleaseRequest).where(FeedbackReleaseRequest.run_id == run_id))
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")
    if request.status != RELEASE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Release request already reviewed")
    return request


def _build_dataset_map(db: Session, dataset_ids: list[str]) -> dict[str, FeedbackTrainingDataset]:
    unique_ids = sorted({item for item in dataset_ids if item})
    if not unique_ids:
        return {}
    stmt = select(FeedbackTrainingDataset).where(FeedbackTrainingDataset.id.in_(unique_ids))
    return {item.id: item for item in db.scalars(stmt)}


def _build_release_map(db: Session, run_ids: list[str]) -> dict[str, FeedbackReleaseRequest]:
    unique_ids = sorted({item for item in run_ids if item})
    if not unique_ids:
        return {}
    stmt = select(FeedbackReleaseRequest).where(FeedbackReleaseRequest.run_id.in_(unique_ids))
    return {item.run_id: item for item in db.scalars(stmt)}


def _serialize_dataset(item: FeedbackTrainingDataset) -> TrainingDatasetRead:
    return TrainingDatasetRead(
        id=item.id,
        strategy_id=item.strategy_id,
        strategy_name=item.strategy_name,
        model_provider=item.model_provider,
        model_name=item.model_name,
        sample_count=item.sample_count,
        incorrect_count=item.incorrect_count,
        correct_count=item.correct_count,
        positive_ratio=item.positive_ratio,
        status=item.status,
        dataset_path=item.dataset_path,
        created_at=_serialize_datetime(item.created_at),
        updated_at=_serialize_datetime(item.updated_at),
    )


def _serialize_run(
    run: FeedbackTrainingRun,
    *,
    dataset_map: dict[str, FeedbackTrainingDataset],
    release_map: dict[str, FeedbackReleaseRequest],
) -> TrainingRunRead:
    dataset = dataset_map.get(run.dataset_id)
    release = release_map.get(run.id)
    return TrainingRunRead(
        id=run.id,
        dataset_id=run.dataset_id,
        strategy_id=run.strategy_id,
        strategy_name=run.strategy_name,
        model_provider=run.model_provider,
        baseline_model_name=run.baseline_model_name,
        route_requested=run.route_requested,
        route_actual=run.route_actual,
        status=run.status,
        candidate_version=run.candidate_version,
        sample_count=run.sample_count if run.sample_count else (dataset.sample_count if dataset else 0),
        evaluation_summary=run.evaluation_summary,
        release_status=release.status if release else None,
        error_message=run.error_message,
        started_at=_serialize_datetime(run.started_at),
        finished_at=_serialize_datetime(run.finished_at),
        created_at=_serialize_datetime(run.created_at),
        updated_at=_serialize_datetime(run.updated_at),
    )


def _serialize_release_request_payload(release_request: FeedbackReleaseRequest | None) -> dict | None:
    if release_request is None:
        return None
    return {
        "id": release_request.id,
        "status": release_request.status,
        "requested_by": release_request.requested_by,
        "reviewer": release_request.reviewer,
        "reviewed_at": _serialize_datetime(release_request.reviewed_at),
        "review_comment": release_request.review_comment,
        "release_payload": release_request.release_payload,
        "is_published": release_request.is_published,
    }


def _serialize_history_item(item: FeedbackTrainingCandidate) -> TrainingHistoryRead:
    return TrainingHistoryRead(
        candidate_id=item.id,
        record_id=item.record_id,
        strategy_id=item.strategy_id,
        strategy_name=item.strategy_name,
        judgement=item.judgement,
        reviewer=item.reviewer,
        comment=item.comment,
        model_provider=item.model_provider,
        model_name=item.model_name,
        reflowed_at=_serialize_datetime(item.reflowed_at),
        reflow_run_id=item.reflow_run_id,
        reflow_dataset_id=item.reflow_dataset_id,
    )


def _feedback_training_root_dir() -> Path:
    return Path(settings.storage_root).expanduser().resolve() / "feedback-training"


def _require_session(entity) -> Session:
    db = object_session(entity)
    if db is None:
        raise RuntimeError("SQLAlchemy session is not available for training entity")
    return db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.astimezone(timezone.utc).isoformat()
