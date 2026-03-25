from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.dashboard_definition import DashboardDefinition
from app.schemas.dashboard_definition import DashboardDefinitionCreate, DashboardDefinitionRead, DashboardDefinitionUpdate
from app.services.ids import generate_id


def serialize_dashboard_definition(dashboard: DashboardDefinition) -> DashboardDefinitionRead:
    return DashboardDefinitionRead(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        definition=dashboard.definition or {},
        status=dashboard.status,
        is_default=dashboard.is_default,
        created_at=_to_iso(dashboard.created_at),
        updated_at=_to_iso(dashboard.updated_at),
    )


def list_dashboard_definitions(db: Session, *, status_filter: str | None = None) -> list[DashboardDefinitionRead]:
    stmt = select(DashboardDefinition)
    if status_filter:
        stmt = stmt.where(DashboardDefinition.status == status_filter.strip().lower())
    stmt = stmt.order_by(DashboardDefinition.is_default.desc(), DashboardDefinition.updated_at.desc(), DashboardDefinition.id.asc())
    dashboards = list(db.scalars(stmt))
    return [serialize_dashboard_definition(item) for item in dashboards]


def get_dashboard_definition_or_404(db: Session, dashboard_id: str) -> DashboardDefinition:
    dashboard = db.get(DashboardDefinition, dashboard_id)
    if dashboard is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard definition not found")
    return dashboard


def create_dashboard_definition(db: Session, payload: DashboardDefinitionCreate) -> DashboardDefinitionRead:
    _ensure_name_unique(db, payload.name)

    if payload.is_default:
        _clear_default_dashboard(db)

    dashboard = DashboardDefinition(
        id=generate_id(),
        name=payload.name,
        description=payload.description,
        definition=payload.definition,
        status=payload.status,
        is_default=payload.is_default,
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return serialize_dashboard_definition(dashboard)


def update_dashboard_definition(
    db: Session,
    dashboard: DashboardDefinition,
    payload: DashboardDefinitionUpdate,
) -> DashboardDefinitionRead:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return serialize_dashboard_definition(dashboard)

    if "name" in updates and updates["name"] is not None and updates["name"] != dashboard.name:
        _ensure_name_unique(db, updates["name"], exclude_dashboard_id=dashboard.id)

    if updates.get("is_default") is True:
        _clear_default_dashboard(db, exclude_dashboard_id=dashboard.id)

    for field_name, value in updates.items():
        setattr(dashboard, field_name, value)

    db.commit()
    db.refresh(dashboard)
    return serialize_dashboard_definition(dashboard)


def delete_dashboard_definition(db: Session, dashboard: DashboardDefinition) -> dict[str, bool]:
    db.delete(dashboard)
    db.commit()
    return {"deleted": True}


def _ensure_name_unique(db: Session, name: str, *, exclude_dashboard_id: str | None = None) -> None:
    stmt = select(DashboardDefinition.id).where(func.lower(DashboardDefinition.name) == name.strip().lower())
    if exclude_dashboard_id:
        stmt = stmt.where(DashboardDefinition.id != exclude_dashboard_id)
    duplicate_id = db.scalar(stmt)
    if duplicate_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dashboard name already exists")


def _clear_default_dashboard(db: Session, *, exclude_dashboard_id: str | None = None) -> None:
    stmt = update(DashboardDefinition).where(DashboardDefinition.is_default.is_(True))
    if exclude_dashboard_id:
        stmt = stmt.where(DashboardDefinition.id != exclude_dashboard_id)
    db.execute(stmt.values(is_default=False))


def _to_iso(value: datetime | None) -> str:
    if value is None:
        return ""
    normalized = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return normalized.isoformat()
