from app.services.providers.base import ModelProviderAdapter, ProviderRequest, ProviderResponse
from app.services.providers.mock_response import build_mock_provider_response


class ZhipuAdapter(ModelProviderAdapter):
    provider = "zhipu"

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        return build_mock_provider_response(self.provider, request)
