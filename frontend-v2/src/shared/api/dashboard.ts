import { apiClient } from './client';

export type DashboardSummary = {
  total_jobs: number;
  total_records: number;
  pending_review_count: number;
  success_rate: number;
  anomaly_rate: number;
  structured_success_rate: number;
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
  created_at: string;
};

export async function getDashboardSummary() {
  const response = await apiClient.get<DashboardSummary>('/api/dashboard/summary');
  return response.data;
}

export async function getDashboardTrends() {
  const response = await apiClient.get<DashboardTrendPoint[]>('/api/dashboard/trends');
  return response.data;
}

export async function getDashboardStrategies() {
  const response = await apiClient.get<StrategyUsagePoint[]>('/api/dashboard/strategies');
  return response.data;
}

export async function getDashboardAnomalies() {
  const response = await apiClient.get<AnomalyCase[]>('/api/dashboard/anomalies');
  return response.data;
}
