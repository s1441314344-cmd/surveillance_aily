import { apiClient } from './client';

export type DashboardSummary = {
  total_jobs: number;
  total_records: number;
  pending_review_count: number;
  schema_invalid_count: number;
  success_rate: number;
  anomaly_rate: number;
  structured_success_rate: number;
  schema_invalid_rate: number;
  reviewed_rate: number;
  confirmed_accuracy_rate: number;
};

export type DashboardTrendPoint = {
  date: string;
  total_jobs: number;
  success_rate: number;
};

export type StrategyUsagePoint = {
  strategy_id: string;
  strategy_name: string;
  usage_count: number;
};

export type AnomalyCase = {
  record_id: string;
  strategy_name: string;
  summary: string;
  anomaly_type: string;
  result_status: string;
  feedback_status: string;
  created_at: string;
};

export type DashboardQueryParams = {
  strategyId?: string;
  modelProvider?: string;
  createdFrom?: string;
  createdTo?: string;
};

const buildDashboardQueryParams = (params?: DashboardQueryParams) => ({
  strategy_id: params?.strategyId || undefined,
  model_provider: params?.modelProvider || undefined,
  created_from: params?.createdFrom || undefined,
  created_to: params?.createdTo || undefined,
});

export async function getDashboardSummary(params?: DashboardQueryParams) {
  const response = await apiClient.get<DashboardSummary>('/api/dashboard/summary', {
    params: buildDashboardQueryParams(params),
  });
  return response.data;
}

export async function getDashboardTrends(params?: DashboardQueryParams) {
  const response = await apiClient.get<DashboardTrendPoint[]>('/api/dashboard/trends', {
    params: buildDashboardQueryParams(params),
  });
  return response.data;
}

export async function getDashboardStrategies(params?: DashboardQueryParams) {
  const response = await apiClient.get<StrategyUsagePoint[]>('/api/dashboard/strategies', {
    params: buildDashboardQueryParams(params),
  });
  return response.data;
}

export async function getDashboardAnomalies(params?: DashboardQueryParams) {
  const response = await apiClient.get<AnomalyCase[]>('/api/dashboard/anomalies', {
    params: buildDashboardQueryParams(params),
  });
  return response.data;
}
