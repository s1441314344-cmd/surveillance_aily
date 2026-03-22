from pydantic import BaseModel, Field


class UserRead(BaseModel):
    id: str
    username: str
    display_name: str
    is_active: bool
    roles: list[str] = Field(default_factory=list)


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str
    roles: list[str] = Field(default_factory=list)


class UserStatusUpdate(BaseModel):
    is_active: bool
