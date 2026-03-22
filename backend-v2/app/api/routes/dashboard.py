from fastapi import APIRouter

from app.schemas.dashboard import AnomalyCase, DashboardSummary, DashboardTrendPoint, StrategyUsagePoint

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary():
    return DashboardSummary(
        total_jobs=0,
        success_rate=0.0,
        anomaly_rate=0.0,
        structured_success_rate=0.0,
        reviewed_rate=0.0,
        confirmed_accuracy_rate=0.0,
    )


@router.get("/trends", response_model=list[DashboardTrendPoint])
def get_dashboard_trends():
    return []


@router.get("/strategies", response_model=list[StrategyUsagePoint])
def get_dashboard_strategies():
    return []


@router.get("/anomalies", response_model=list[AnomalyCase])
def get_dashboard_anomalies():
    return []
