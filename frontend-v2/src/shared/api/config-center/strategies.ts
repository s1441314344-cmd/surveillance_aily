import { apiClient } from '../client';

export type Strategy = {
  id: string;
  name: string;
  scene_description: string;
  prompt_template: string;
  model_provider: string;
  model_name: string;
  result_format: 'json_schema' | 'json_object' | 'auto' | 'text';
  response_schema: Record<string, unknown>;
  status: string;
  version: number;
  is_preset: boolean;
};

export type StrategyPayload = {
  name: string;
  scene_description: string;
  prompt_template: string;
  model_provider: string;
  model_name: string;
  result_format: 'json_schema' | 'json_object' | 'auto' | 'text';
  response_schema: Record<string, unknown>;
  status: string;
};

export type SchemaValidationResponse = {
  strategy_id: string;
  valid: boolean;
  errors: string[];
};

export async function listStrategies(params?: { status?: string; modelProvider?: string }) {
  const response = await apiClient.get<Strategy[]>('/api/strategies', {
    params: {
      status: params?.status || undefined,
      model_provider: params?.modelProvider || undefined,
    },
  });
  return response.data;
}

export async function createStrategy(payload: StrategyPayload) {
  const response = await apiClient.post<Strategy>('/api/strategies', payload);
  return response.data;
}

export async function updateStrategy(strategyId: string, payload: Partial<StrategyPayload>) {
  const response = await apiClient.patch<Strategy>(`/api/strategies/${strategyId}`, payload);
  return response.data;
}

export async function updateStrategyStatus(strategyId: string, status: string) {
  const response = await apiClient.patch<Strategy>(`/api/strategies/${strategyId}/status`, { status });
  return response.data;
}

export async function validateStrategySchema(strategyId: string, schema: Record<string, unknown>) {
  const response = await apiClient.post<SchemaValidationResponse>(
    `/api/strategies/${strategyId}/validate-schema`,
    { schema },
  );
  return response.data;
}
