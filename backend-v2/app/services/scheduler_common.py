from datetime import datetime, timezone

from app.core.config import get_settings


settings = get_settings()


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def infer_expected_signal_keys(*, strategy_snapshot: dict) -> set[str]:
    mapping = strategy_snapshot.get("signal_mapping")
    if isinstance(mapping, dict) and mapping:
        return {str(key).strip().lower() for key in mapping.keys() if str(key).strip()}
    return {"person", "fire", "leak"}
