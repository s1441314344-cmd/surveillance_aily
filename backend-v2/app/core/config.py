from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    storage_root: str = "./data/storage"
    cors_origins: list[str] = ["http://localhost:5174", "http://127.0.0.1:5174"]
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
