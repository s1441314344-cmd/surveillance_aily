from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.strategy import (
    StrategyCreate,
    StrategyRead,
    StrategySchemaValidateRequest,
    StrategySchemaValidateResponse,
    StrategyStatusUpdate,
    StrategyUpdate,
)
from app.services.rbac import ROLE_STRATEGY_CONFIGURATOR, ROLE_SYSTEM_ADMIN
from app.services.strategy_service import (
    create_strategy as create_strategy_record,
    get_strategy_or_404,
    list_strategies as list_strategy_records,
    serialize_strategy,
    update_strategy as update_strategy_record,
    update_strategy_status as update_strategy_status_record,
    validate_response_schema,
)

router = APIRouter()


@router.get("", response_model=list[StrategyRead])
def list_strategies(
    status: str | None = None,
    model_provider: str | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_strategy_records(db, status_filter=status, model_provider=model_provider)


@router.post("", response_model=StrategyRead)
def create_strategy(
    payload: StrategyCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    return create_strategy_record(db, payload)


@router.get("/{strategy_id}", response_model=StrategyRead)
def get_strategy(
    strategy_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_strategy(get_strategy_or_404(db, strategy_id))


@router.patch("/{strategy_id}", response_model=StrategyRead)
def update_strategy(
    strategy_id: str,
    payload: StrategyUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    strategy = get_strategy_or_404(db, strategy_id)
    return update_strategy_record(db, strategy, payload)


@router.patch("/{strategy_id}/status", response_model=StrategyRead)
def update_strategy_status(
    strategy_id: str,
    payload: StrategyStatusUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    strategy = get_strategy_or_404(db, strategy_id)
    return update_strategy_status_record(db, strategy, payload.status)


@router.post("/{strategy_id}/validate-schema", response_model=StrategySchemaValidateResponse)
def validate_strategy_schema(
    strategy_id: str,
    payload: StrategySchemaValidateRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR)),
    db: Session = Depends(get_db),
):
    get_strategy_or_404(db, strategy_id)
    errors = validate_response_schema(payload.schema_definition)
    return StrategySchemaValidateResponse(strategy_id=strategy_id, valid=not errors, errors=errors)
