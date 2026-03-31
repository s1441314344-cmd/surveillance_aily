from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Camera(Base, TimestampMixin):
    __tablename__ = "cameras"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protocol: Mapped[str] = mapped_column(String(20), default="rtsp", nullable=False)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password_encrypted: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rtsp_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    frame_frequency_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    resolution: Mapped[str] = mapped_column(String(20), default="1080p", nullable=False)
    jpeg_quality: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(255), nullable=False)


class CameraStatusLog(Base, TimestampMixin):
    __tablename__ = "camera_status_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    connection_status: Mapped[str] = mapped_column(String(20), nullable=False)
    alert_status: Mapped[str] = mapped_column(String(20), nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class CameraTriggerRule(Base, TimestampMixin):
    __tablename__ = "camera_trigger_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    event_key: Mapped[str] = mapped_column(String(80), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    min_confidence: Mapped[float] = mapped_column(Float, default=0.6, nullable=False)
    min_consecutive_frames: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    match_mode: Mapped[str] = mapped_column(String(20), default="simple", nullable=False)
    expression_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    action_policy_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
