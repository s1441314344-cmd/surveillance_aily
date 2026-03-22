from pydantic import BaseModel, ConfigDict, Field


class StrategyBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    scene_description: str
    prompt_template: str
    model_provider: str
    model_name: str
    response_schema: dict = Field(default_factory=dict)
    status: str = "active"


class StrategyCreate(StrategyBase):
    pass


class StrategyUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = None
    scene_description: str | None = None
    prompt_template: str | None = None
    model_provider: str | None = None
    model_name: str | None = None
    response_schema: dict | None = None
    status: str | None = None


class StrategyStatusUpdate(BaseModel):
    status: str


class StrategyRead(StrategyBase):
    id: str
    version: int
    is_preset: bool


class StrategySchemaValidateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_definition: dict = Field(alias="schema")


class StrategySchemaValidateResponse(BaseModel):
    strategy_id: str
    valid: bool
    errors: list[str]
