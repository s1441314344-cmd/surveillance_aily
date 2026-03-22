from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_jobs: int
    success_rate: float
    anomaly_rate: float
    structured_success_rate: float
    reviewed_rate: float
    confirmed_accuracy_rate: float


class DashboardTrendPoint(BaseModel):
    date: str
    total_jobs: int
    success_rate: float


class StrategyUsagePoint(BaseModel):
    strategy_id: str
    strategy_name: str
    usage_count: int


class AnomalyCase(BaseModel):
    record_id: str
    strategy_name: str
    summary: str
    created_at: str
