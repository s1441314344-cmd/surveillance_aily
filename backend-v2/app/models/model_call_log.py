from sqlalchemy import Boolean, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ModelCallLog(Base, TimestampMixin):
    __tablename__ = "model_call_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    trigger_source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    response_format: Mapped[str | None] = mapped_column(String(30), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    input_image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    job_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    schedule_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    camera_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    strategy_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
