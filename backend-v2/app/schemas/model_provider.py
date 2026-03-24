from pydantic import BaseModel


class ModelProviderRead(BaseModel):
    provider: str
    display_name: str
    base_url: str
    api_key_masked: str = ""
    has_api_key: bool = False
    default_model: str
    timeout_seconds: int
    status: str


class ModelProviderUpdate(BaseModel):
    display_name: str | None = None
    base_url: str
    api_key: str | None = None
    default_model: str
    timeout_seconds: int = 120
    status: str = "inactive"
