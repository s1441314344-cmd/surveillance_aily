from functools import lru_cache

from pydantic import field_validator

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # pragma: no cover - compatibility with older pydantic-settings
    from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_CORS_ORIGIN_PORTS = range(5173, 5181)
DEFAULT_CORS_ORIGINS = [
    f"http://{host}:{port}"
    for port in DEFAULT_CORS_ORIGIN_PORTS
    for host in ("localhost", "127.0.0.1")
]


class Settings(BaseSettings):
    app_name: str = "Surveillance V2 API"
    app_env: str = "development"
    app_debug: bool = True
    api_v1_prefix: str = "/api"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/surveillance_v2"
    redis_url: str = "redis://localhost:6379/0"
    celery_enabled: bool = True
    scheduler_poll_interval_seconds: int = 30
    scheduler_camera_status_sweep_enabled: bool = True
    scheduler_camera_status_sweep_interval_seconds: int = 60
    feedback_training_enabled: bool = True
    feedback_training_cron: str = "0 2 * * *"
    feedback_training_min_samples: int = 30
    feedback_training_positive_ratio: float = 1.0
    feedback_training_max_samples_per_strategy: int = 2000
    feedback_training_route_default: str = "finetune"
    local_detector_enabled: bool = True
    local_detector_base_url: str = "http://localhost:8091"
    local_detector_timeout_seconds: int = 5
    local_detector_person_threshold: float = 0.35
    local_detector_strict_block: bool = True
    alert_lark_notify_enabled: bool = False
    alert_lark_cli_bin: str = "lark-cli"
    alert_lark_cli_timeout_seconds: int = 15
    storage_root: str = "./data/storage"
    provider_mock_fallback_enabled: bool = True
    ocr_service_base_url: str = "http://127.0.0.1:8092"
    ocr_service_timeout_seconds: int = 30
    cors_origins: str | list[str] = DEFAULT_CORS_ORIGINS
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "admin123456"
    bootstrap_admin_display_name: str = "开发管理员"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
