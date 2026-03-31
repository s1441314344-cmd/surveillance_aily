from app.services.providers.base import ModelProviderAdapter
from app.services.providers.ark_adapter import ArkAdapter
from app.services.providers.google_adapter import GoogleAdapter
from app.services.providers.openai_adapter import OpenAIAdapter
from app.services.providers.zhipu_adapter import ZhipuAdapter


def get_provider_adapter(provider: str) -> ModelProviderAdapter:
    normalized = (provider or "").strip().lower()
    if normalized == "google":
        return GoogleAdapter()
    if normalized in {"ark", "doubao", "volcengine", "huoshan"}:
        return ArkAdapter()
    if normalized == "openai":
        return OpenAIAdapter()
    return ZhipuAdapter()
