from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ALLOWED_DASHBOARD_STATUSES = {"active", "inactive"}


class DashboardDefinitionBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    definition: dict = Field(default_factory=dict)
    status: str = "active"
    is_default: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Dashboard name cannot be empty")
        return trimmed

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_DASHBOARD_STATUSES:
            raise ValueError("Dashboard status must be active or inactive")
        return normalized


class DashboardDefinitionCreate(DashboardDefinitionBase):
    pass


class DashboardDefinitionUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    definition: dict | None = None
    status: str | None = None
    is_default: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Dashboard name cannot be empty")
        return trimmed

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in ALLOWED_DASHBOARD_STATUSES:
            raise ValueError("Dashboard status must be active or inactive")
        return normalized


class DashboardDefinitionRead(DashboardDefinitionBase):
    id: str
    created_at: str
    updated_at: str


class DashboardDefinitionValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    definition: dict

    @model_validator(mode="before")
    @classmethod
    def normalize_definition_aliases(cls, value):
        if not isinstance(value, dict):
            return value
        if "definition" in value:
            return value
        if "dashboard_definition" in value:
            return {"definition": value["dashboard_definition"]}
        return value


class DashboardDefinitionValidateResponse(BaseModel):
    dashboard_id: str | None = None
    valid: bool
    errors: list[str]
