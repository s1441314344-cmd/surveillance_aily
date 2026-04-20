import { apiClient } from '../client';

export type ModelProvider = {
  provider: string;
  display_name: string;
  base_url: string;
  api_key_masked: string;
  has_api_key: boolean;
  default_model: string;
  timeout_seconds: number;
  status: string;
};

export type ModelProviderUpdatePayload = {
  display_name?: string;
  base_url: string;
  api_key?: string;
  default_model: string;
  timeout_seconds: number;
  status: string;
};

export type ModelProviderDebugPayload = {
  model?: string;
  prompt: string;
  response_format: 'text' | 'json_object' | 'json_schema' | 'auto';
  response_schema?: Record<string, unknown>;
  include_sample_image: boolean;
};

export type ModelProviderDebugResult = {
  provider: string;
  display_name: string;
  base_url: string;
  model: string;
  response_format: string;
  include_sample_image: boolean;
  success: boolean;
  has_api_key: boolean;
  status: string;
  timeout_seconds: number;
  request_payload: Record<string, unknown>;
  logs: Array<{
    level: string;
    message: string;
  }>;
  raw_response: string;
  normalized_json: Record<string, unknown> | null;
  error_message: string | null;
  usage: Record<string, unknown> | null;
};

export type ModelCallLog = {
  id: string;
  provider: string;
  model_name: string;
  trigger_type: string;
  trigger_source: string | null;
  response_format: string | null;
  success: boolean;
  error_message: string | null;
  usage: Record<string, unknown> | null;
  input_image_count: number;
  job_id: string | null;
  schedule_id: string | null;
  camera_id: string | null;
  strategy_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
};

export async function listModelProviders() {
  const response = await apiClient.get<ModelProvider[]>('/api/model-providers');
  return response.data;
}

export async function updateModelProvider(provider: string, payload: ModelProviderUpdatePayload) {
  const response = await apiClient.put<ModelProvider>(`/api/model-providers/${provider}`, payload);
  return response.data;
}

export async function debugModelProvider(provider: string, payload: ModelProviderDebugPayload) {
  const response = await apiClient.post<ModelProviderDebugResult>(`/api/model-providers/${provider}/debug`, payload);
  return response.data;
}

export async function listModelCallLogs(params?: {
  provider?: string;
  triggerType?: string;
  success?: boolean;
  limit?: number;
}) {
  const response = await apiClient.get<ModelCallLog[]>('/api/model-providers/call-logs', {
    params: {
      provider: params?.provider || undefined,
      trigger_type: params?.triggerType || undefined,
      success: params?.success,
      limit: params?.limit ?? 100,
    },
  });
  return response.data;
}
