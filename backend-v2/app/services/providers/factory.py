from app.services.providers.base import ModelProviderAdapter
from app.services.providers.openai_adapter import OpenAIAdapter
from app.services.providers.zhipu_adapter import ZhipuAdapter


def get_provider_adapter(provider: str) -> ModelProviderAdapter:
    if provider == "openai":
        return OpenAIAdapter()
    return ZhipuAdapter()
