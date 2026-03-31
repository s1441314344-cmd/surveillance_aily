from dataclasses import dataclass
from typing import Protocol


@dataclass
class ProviderRequest:
    model: str
    prompt: str
    image_paths: list[str]
    response_format: str = "json_schema"
    response_schema: dict | None = None


@dataclass
class ProviderResponse:
    success: bool
    raw_response: str
    normalized_json: dict | None
    error_message: str | None = None
    usage: dict | None = None


class ModelProviderAdapter(Protocol):
    provider: str

    def analyze(self, request: ProviderRequest) -> ProviderResponse:
        ...
