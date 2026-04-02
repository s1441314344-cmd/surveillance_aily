from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FeedbackTrainingCandidate(Base, TimestampMixin):
    __tablename__ = "feedback_training_candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    record_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    feedback_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    strategy_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    strategy_name: Mapped[str] = mapped_column(String(120), nullable=False)
    judgement: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    corrected_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_image_path: Mapped[str] = mapped_column(Text, nullable=False)
    strategy_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sample_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_reflowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    reflowed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reflow_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    reflow_dataset_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)


class FeedbackTrainingDataset(Base, TimestampMixin):
    __tablename__ = "feedback_training_datasets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    strategy_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    strategy_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    positive_ratio: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    dataset_path: Mapped[str] = mapped_column(Text, nullable=False)
    sample_manifest: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ready", nullable=False, index=True)
    built_by: Mapped[str] = mapped_column(String(100), nullable=False)
    trigger_source: Mapped[str] = mapped_column(String(40), nullable=False)


class FeedbackTrainingRun(Base, TimestampMixin):
    __tablename__ = "feedback_training_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    strategy_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    strategy_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    baseline_model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    route_requested: Mapped[str] = mapped_column(String(30), nullable=False)
    route_actual: Mapped[str] = mapped_column(String(30), nullable=False)
    candidate_version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    candidate_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False, index=True)
    sample_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    evaluation_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evaluation_report_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_source: Mapped[str] = mapped_column(String(40), nullable=False)
    triggered_by: Mapped[str] = mapped_column(String(100), nullable=False)


class FeedbackReleaseRequest(Base, TimestampMixin):
    __tablename__ = "feedback_release_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    strategy_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    candidate_version: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    requested_by: Mapped[str] = mapped_column(String(100), nullable=False)
    reviewer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    release_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class FeedbackTrainingConfig(Base, TimestampMixin):
    __tablename__ = "feedback_training_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    min_samples: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
