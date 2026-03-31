from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.schemas.model_provider import (
    ModelProviderDebugRead,
    ModelProviderDebugRequest,
    ModelProviderRead,
    ModelProviderUpdate,
)
from app.schemas.auth import CurrentUser
from app.services.model_provider_service import debug_model_provider
from app.services.model_provider_service import list_model_providers as list_model_provider_records
from app.services.model_provider_service import upsert_model_provider
from app.services.rbac import ROLE_STRATEGY_CONFIGURATOR, ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[ModelProviderRead])
def list_model_providers(
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return list_model_provider_records(db)


@router.put("/{provider}", response_model=ModelProviderRead)
def update_model_provider(
    provider: str,
    payload: ModelProviderUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return upsert_model_provider(db, provider, payload)


@router.post("/{provider}/debug", response_model=ModelProviderDebugRead)
def debug_provider(
    provider: str,
    payload: ModelProviderDebugRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return debug_model_provider(db, provider_name=provider, payload=payload)
