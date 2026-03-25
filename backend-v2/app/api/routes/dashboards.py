from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.dashboard_definition import (
    DashboardDefinitionCreate,
    DashboardDefinitionRead,
    DashboardDefinitionUpdate,
    DashboardDefinitionValidateRequest,
    DashboardDefinitionValidateResponse,
)
from app.services.dashboard_definition_service import (
    collect_dashboard_definition_errors,
    create_dashboard_definition as create_dashboard_definition_record,
    delete_dashboard_definition as delete_dashboard_definition_record,
    get_dashboard_definition_or_404,
    list_dashboard_definitions as list_dashboard_definition_records,
    serialize_dashboard_definition,
    update_dashboard_definition as update_dashboard_definition_record,
)
from app.services.rbac import ROLE_SYSTEM_ADMIN

router = APIRouter()


@router.get("", response_model=list[DashboardDefinitionRead])
def list_dashboards(
    status: str | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_dashboard_definition_records(db, status_filter=status)


@router.post("", response_model=DashboardDefinitionRead)
def create_dashboard(
    payload: DashboardDefinitionCreate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    return create_dashboard_definition_record(db, payload)


@router.post("/validate-definition", response_model=DashboardDefinitionValidateResponse)
def validate_dashboard_definition_draft(
    payload: DashboardDefinitionValidateRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
):
    errors = collect_dashboard_definition_errors(payload.definition)
    return DashboardDefinitionValidateResponse(valid=not errors, errors=errors)


@router.get("/{dashboard_id}", response_model=DashboardDefinitionRead)
def get_dashboard(
    dashboard_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_dashboard_definition(get_dashboard_definition_or_404(db, dashboard_id))


@router.post("/{dashboard_id}/validate-definition", response_model=DashboardDefinitionValidateResponse)
def validate_dashboard_definition(
    dashboard_id: str,
    payload: DashboardDefinitionValidateRequest,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    get_dashboard_definition_or_404(db, dashboard_id)
    errors = collect_dashboard_definition_errors(payload.definition)
    return DashboardDefinitionValidateResponse(dashboard_id=dashboard_id, valid=not errors, errors=errors)


@router.patch("/{dashboard_id}", response_model=DashboardDefinitionRead)
def update_dashboard(
    dashboard_id: str,
    payload: DashboardDefinitionUpdate,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    dashboard = get_dashboard_definition_or_404(db, dashboard_id)
    return update_dashboard_definition_record(db, dashboard, payload)


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    _: CurrentUser = Depends(require_roles(ROLE_SYSTEM_ADMIN)),
    db: Session = Depends(get_db),
):
    dashboard = get_dashboard_definition_or_404(db, dashboard_id)
    return delete_dashboard_definition_record(db, dashboard)
