from pydantic import BaseModel, Field


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


class ModelProviderDebugRequest(BaseModel):
    model: str | None = None
    prompt: str = "请返回一句调试成功确认，并说明当前模型已可用。"
    response_format: str = "text"
    response_schema: dict | None = None
    include_sample_image: bool = True


class ModelProviderDebugLog(BaseModel):
    level: str
    message: str


class ModelProviderDebugRead(BaseModel):
    provider: str
    display_name: str
    base_url: str
    model: str
    response_format: str
    include_sample_image: bool
    success: bool
    has_api_key: bool
    status: str
    timeout_seconds: int
    request_payload: dict = Field(default_factory=dict)
    logs: list[ModelProviderDebugLog] = Field(default_factory=list)
    raw_response: str = ""
    normalized_json: dict | None = None
    error_message: str | None = None
    usage: dict | None = None
