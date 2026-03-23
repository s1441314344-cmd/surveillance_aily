from sqlalchemy import JSON, BigInteger, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OperationAuditLog(Base, TimestampMixin):
    __tablename__ = "operation_audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    operator_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    operator_username: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    http_method: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    request_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    duration_ms: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    client_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
