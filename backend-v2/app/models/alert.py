from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AlertEvent(Base, TimestampMixin):
    __tablename__ = "alert_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    camera_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    strategy_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    strategy_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rule_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    rule_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    event_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AlertWebhookEndpoint(Base, TimestampMixin):
    __tablename__ = "alert_webhook_endpoints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=5)


class AlertWebhookDelivery(Base, TimestampMixin):
    __tablename__ = "alert_webhook_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    endpoint_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    response_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AlertNotificationRoute(Base, TimestampMixin):
    __tablename__ = "alert_notification_routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    strategy_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    event_key: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    camera_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    recipient_type: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient_id: Mapped[str] = mapped_column(String(120), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
