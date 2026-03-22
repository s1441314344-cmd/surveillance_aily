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
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_summary_data(db)


@router.get("/trends", response_model=list[DashboardTrendPoint])
def get_dashboard_trends(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_trends_data(db)


@router.get("/strategies", response_model=list[StrategyUsagePoint])
def get_dashboard_strategies(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_strategies_data(db)


@router.get("/anomalies", response_model=list[AnomalyCase])
def get_dashboard_anomalies(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_anomalies_data(db)
