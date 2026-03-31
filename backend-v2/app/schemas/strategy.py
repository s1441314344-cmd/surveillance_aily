from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ALLOWED_RESULT_FORMATS = {"json_schema", "json_object", "auto", "text"}


class StrategyBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    scene_description: str
    prompt_template: str
    model_provider: str
    model_name: str
    result_format: str = "json_schema"
    response_schema: dict = Field(default_factory=dict)
    status: str = "active"
    is_signal_strategy: bool = False
    signal_mapping: dict[str, str] | None = None

    @field_validator("result_format")
    @classmethod
    def validate_result_format(cls, value: str) -> str:
        normalized = (value or "json_schema").strip().lower()
        if normalized not in ALLOWED_RESULT_FORMATS:
            raise ValueError(f"result_format must be one of {sorted(ALLOWED_RESULT_FORMATS)}")
        return normalized


class StrategyCreate(StrategyBase):
    pass


class StrategyUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = None
    scene_description: str | None = None
    prompt_template: str | None = None
    model_provider: str | None = None
    model_name: str | None = None
    result_format: str | None = None
    response_schema: dict | None = None
    status: str | None = None
    is_signal_strategy: bool | None = None
    signal_mapping: dict[str, str] | None = None

    @field_validator("result_format")
    @classmethod
    def validate_result_format(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ALLOWED_RESULT_FORMATS:
            raise ValueError(f"result_format must be one of {sorted(ALLOWED_RESULT_FORMATS)}")
        return normalized


class StrategyStatusUpdate(BaseModel):
    status: str


class StrategyRead(StrategyBase):
    id: str
    version: int
    is_preset: bool


class StrategySchemaValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_definition: dict

    @model_validator(mode="before")
    @classmethod
    def normalize_schema_aliases(cls, value):
        if not isinstance(value, dict):
            return value
        if "schema_definition" in value:
            return value
        if "schema" in value:
            return {"schema_definition": value["schema"]}
        return value


class StrategySchemaValidateResponse(BaseModel):
    strategy_id: str
    valid: bool
    errors: list[str]
