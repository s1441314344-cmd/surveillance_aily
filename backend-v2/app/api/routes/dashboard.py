from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.dashboard import AnomalyCase, DashboardSummary, DashboardTrendPoint, StrategyUsagePoint
from app.services.dashboard_service import (
    get_dashboard_anomalies as get_dashboard_anomalies_data,
    get_dashboard_strategies as get_dashboard_strategies_data,
    get_dashboard_summary as get_dashboard_summary_data,
    get_dashboard_trends as get_dashboard_trends_data,
)

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_summary_data(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )


@router.get("/trends", response_model=list[DashboardTrendPoint])
def get_dashboard_trends(
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_trends_data(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )


@router.get("/strategies", response_model=list[StrategyUsagePoint])
def get_dashboard_strategies(
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_strategies_data(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )


@router.get("/anomalies", response_model=list[AnomalyCase])
def get_dashboard_anomalies(
    strategy_id: str | None = None,
    model_provider: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_anomalies_data(
        db,
        strategy_id=strategy_id,
        model_provider=model_provider,
        created_from=created_from,
        created_to=created_to,
    )
