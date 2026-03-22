from sqlalchemy import BigInteger, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TaskRecord(Base, TimestampMixin):
    __tablename__ = "task_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    strategy_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    input_image_path: Mapped[str] = mapped_column(Text, nullable=False)
    preview_image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    camera_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_model_response: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_status: Mapped[str] = mapped_column(String(30), nullable=False)
    duration_ms: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    feedback_status: Mapped[str] = mapped_column(String(20), default="unreviewed", nullable=False)


class PredictionFeedback(Base, TimestampMixin):
    __tablename__ = "prediction_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    record_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    judgement: Mapped[str] = mapped_column(String(20), nullable=False)
    corrected_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer: Mapped[str] = mapped_column(String(100), nullable=False)
