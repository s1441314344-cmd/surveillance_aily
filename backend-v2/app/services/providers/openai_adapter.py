from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse


class OpenAIAdapter(ModelProviderAdapter):
    provider = "openai"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(
            success=False,
            raw_response="",
            normalized_json=None,
            error_message="OpenAI adapter skeleton not implemented yet",
        )
