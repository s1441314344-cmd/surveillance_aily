from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CameraSignalMonitorConfig(Base, TimestampMixin):
    __tablename__ = "camera_signal_monitor_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    runtime_mode: Mapped[str] = mapped_column(String(20), default="daemon", nullable=False)
    signal_strategy_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    strict_local_gate: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    monitor_interval_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    schedule_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    schedule_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manual_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    roi_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    roi_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_height: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_shape: Mapped[str] = mapped_column(String(20), default="rect", nullable=False)
    roi_points: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class CameraSignalState(Base, TimestampMixin):
    __tablename__ = "camera_signal_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    signal_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    last_confidence: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    consecutive_hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CameraRuleHitLog(Base, TimestampMixin):
    __tablename__ = "camera_rule_hit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    rule_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    matched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    event_key: Mapped[str] = mapped_column(String(80), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    required_confidence: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    consecutive_hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    required_consecutive_hits: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    signals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expression_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    media_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    alert_event_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
