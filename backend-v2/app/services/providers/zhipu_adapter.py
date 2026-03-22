from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse


class ZhipuAdapter(ModelProviderAdapter):
    provider = "zhipu"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(
            success=False,
            raw_response="",
            normalized_json=None,
            error_message="Zhipu adapter skeleton not implemented yet",
        )
