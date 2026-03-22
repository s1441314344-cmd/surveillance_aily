from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ModelProvider(Base, TimestampMixin):
    __tablename__ = "model_providers"

    provider: Mapped[str] = mapped_column(String(50), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_encrypted: Mapped[str | None] = mapped_column(String(512), nullable=True)
    default_model: Mapped[str] = mapped_column(String(100), nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="inactive", nullable=False)
