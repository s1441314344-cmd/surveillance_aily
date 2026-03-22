import { apiClient } from './client';

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

export type Strategy = {
  id: string;
  name: string;
  scene_description: string;
  prompt_template: string;
  model_provider: string;
  model_name: string;
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
  response_schema: Record<string, unknown>;
  status: string;
};

export type SchemaValidationResponse = {
  strategy_id: string;
  valid: boolean;
  errors: string[];
};

export type Camera = {
  id: string;
  name: string;
  location: string | null;
  ip_address: string | null;
  port: number | null;
  protocol: string;
  username: string | null;
  rtsp_url: string | null;
  frame_frequency_seconds: number;
  resolution: string;
  jpeg_quality: number;
  storage_path: string;
  has_password: boolean;
};

export type CameraPayload = {
  name: string;
  location?: string | null;
  ip_address?: string | null;
  port?: number | null;
  protocol: string;
  username?: string | null;
  password?: string;
  rtsp_url?: string | null;
  frame_frequency_seconds: number;
  resolution: string;
  jpeg_quality: number;
  storage_path: string;
};

export type CameraStatus = {
  camera_id: string;
  connection_status: string;
  alert_status: string;
  last_error: string | null;
  last_checked_at: string | null;
};

export async function listModelProviders() {
  const response = await apiClient.get<ModelProvider[]>('/api/model-providers');
  return response.data;
}

export async function updateModelProvider(provider: string, payload: ModelProviderUpdatePayload) {
  const response = await apiClient.put<ModelProvider>(`/api/model-providers/${provider}`, payload);
  return response.data;
}

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

export async function listCameras() {
  const response = await apiClient.get<Camera[]>('/api/cameras');
  return response.data;
}

export async function createCamera(payload: CameraPayload) {
  const response = await apiClient.post<Camera>('/api/cameras', payload);
  return response.data;
}

export async function updateCamera(cameraId: string, payload: Partial<CameraPayload>) {
  const response = await apiClient.patch<Camera>(`/api/cameras/${cameraId}`, payload);
  return response.data;
}

export async function deleteCamera(cameraId: string) {
  const response = await apiClient.delete<{ deleted: boolean }>(`/api/cameras/${cameraId}`);
  return response.data;
}

export async function getCameraStatus(cameraId: string) {
  const response = await apiClient.get<CameraStatus>(`/api/cameras/${cameraId}/status`);
  return response.data;
}

export async function checkCameraStatus(cameraId: string) {
  const response = await apiClient.post<CameraStatus>(`/api/cameras/${cameraId}/check`);
  return response.data;
}
