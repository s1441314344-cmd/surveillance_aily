import { apiClient } from '../client';

export type TrainingOverview = {
  reviewed_samples: number;
  candidate_samples: number;
  pending_release_requests: number;
  last_run_id: string | null;
  last_run_status: string | null;
  last_run_at: string | null;
  last_error: string | null;
};

export type TrainingConfig = {
  min_samples: number;
};

export type TrainingDataset = {
  id: string;
  strategy_id: string;
  strategy_name: string;
  model_provider: string;
  model_name: string;
  sample_count: number;
  incorrect_count: number;
  correct_count: number;
  positive_ratio: number;
  status: string;
  dataset_path: string;
  created_at: string | null;
  updated_at: string | null;
};

export type TrainingRun = {
  id: string;
  dataset_id: string;
  strategy_id: string;
  strategy_name: string;
  model_provider: string;
  baseline_model_name: string;
  route_requested: string;
  route_actual: string;
  status: string;
  candidate_version: string | null;
  sample_count: number;
  evaluation_summary: Record<string, unknown> | null;
  release_status: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TrainingHistory = {
  candidate_id: string;
  record_id: string;
  strategy_id: string;
  strategy_name: string;
  judgement: string;
  reviewer: string | null;
  comment: string | null;
  model_provider: string;
  model_name: string;
  reflowed_at: string | null;
  reflow_run_id: string | null;
  reflow_dataset_id: string | null;
};

export type TrainingRunDetail = TrainingRun & {
  candidate_snapshot: Record<string, unknown> | null;
  evaluation_report_path: string | null;
  release_request: Record<string, unknown> | null;
};

export type TrainingPipelineRunResponse = {
  trigger_source: string;
  triggered_by: string;
  strategy_id: string | null;
  dataset_ids: string[];
  run_ids: string[];
  skipped: Array<Record<string, unknown>>;
};

export type TrainingRunReviewResponse = {
  run_id: string;
  release_request_id: string;
  status: string;
  reviewed_at: string | null;
  reviewer: string | null;
  comment: string | null;
};

export async function getTrainingOverview(params?: { provider?: string }) {
  const response = await apiClient.get<TrainingOverview>('/api/training/overview', {
    params: {
      provider: params?.provider || undefined,
    },
  });
  return response.data;
}

export async function runTrainingPipeline(payload?: { strategy_id?: string }) {
  const response = await apiClient.post<TrainingPipelineRunResponse>('/api/training/pipeline/run', payload || {});
  return response.data;
}

export async function getTrainingConfig() {
  const response = await apiClient.get<TrainingConfig>('/api/training/config');
  return response.data;
}

export async function updateTrainingConfig(payload: TrainingConfig) {
  const response = await apiClient.put<TrainingConfig>('/api/training/config', payload);
  return response.data;
}

export async function listTrainingDatasets(params?: {
  provider?: string;
  strategyId?: string;
  limit?: number;
}) {
  const response = await apiClient.get<TrainingDataset[]>('/api/training/datasets', {
    params: {
      provider: params?.provider || undefined,
      strategy_id: params?.strategyId || undefined,
      limit: params?.limit ?? 100,
    },
  });
  return response.data;
}

export async function listTrainingRuns(params?: {
  provider?: string;
  strategyId?: string;
  status?: string;
  limit?: number;
}) {
  const response = await apiClient.get<TrainingRun[]>('/api/training/runs', {
    params: {
      provider: params?.provider || undefined,
      strategy_id: params?.strategyId || undefined,
      status: params?.status || undefined,
      limit: params?.limit ?? 100,
    },
  });
  return response.data;
}

export async function listTrainingHistory(params?: {
  provider?: string;
  strategyId?: string;
  limit?: number;
}) {
  const response = await apiClient.get<TrainingHistory[]>('/api/training/history', {
    params: {
      provider: params?.provider || undefined,
      strategy_id: params?.strategyId || undefined,
      limit: params?.limit ?? 100,
    },
  });
  return response.data;
}

export async function getTrainingRunDetail(runId: string) {
  const response = await apiClient.get<TrainingRunDetail>(`/api/training/runs/${runId}`);
  return response.data;
}

export async function approveTrainingRun(runId: string, payload?: { comment?: string }) {
  const response = await apiClient.post<TrainingRunReviewResponse>(
    `/api/training/runs/${runId}/approve`,
    payload || {},
  );
  return response.data;
}

export async function rejectTrainingRun(runId: string, payload?: { comment?: string }) {
  const response = await apiClient.post<TrainingRunReviewResponse>(
    `/api/training/runs/${runId}/reject`,
    payload || {},
  );
  return response.data;
}
