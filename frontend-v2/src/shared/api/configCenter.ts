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

export type CameraStatusSweepSummary = {
  checked_count: number;
  failed_count: number;
  total_count: number;
};

export type CameraStatusLog = {
  id: string;
  camera_id: string;
  connection_status: string;
  alert_status: string;
  last_error: string | null;
  created_at: string;
};

export type CameraDiagnostic = {
  camera_id: string;
  camera_name: string;
  protocol: string;
  stream_url_masked: string | null;
  success: boolean;
  capture_mode: string;
  latency_ms: number;
  frame_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  snapshot_path: string | null;
  error_message: string | null;
  checked_at: string;
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

export async function listCameraStatuses(params?: { cameraIds?: string[]; alertOnly?: boolean }) {
  const response = await apiClient.get<CameraStatus[]>('/api/cameras/statuses', {
    params: {
      camera_ids: params?.cameraIds?.length ? params.cameraIds.join(',') : undefined,
      alert_only: params?.alertOnly || undefined,
    },
  });
  return response.data;
}

export async function checkCameraStatus(cameraId: string) {
  const response = await apiClient.post<CameraStatus>(`/api/cameras/${cameraId}/check`);
  return response.data;
}

export async function checkAllCamerasStatus(params?: { cameraIds?: string[] }) {
  const response = await apiClient.post<CameraStatusSweepSummary>('/api/cameras/check-all', undefined, {
    params: {
      camera_ids: params?.cameraIds?.length ? params.cameraIds.join(',') : undefined,
    },
  });
  return response.data;
}

export async function listCameraStatusLogs(cameraId: string, params?: { limit?: number }) {
  const response = await apiClient.get<CameraStatusLog[]>(`/api/cameras/${cameraId}/status-logs`, {
    params: {
      limit: params?.limit ?? 20,
    },
  });
  return response.data;
}

export async function diagnoseCamera(cameraId: string, params?: { saveSnapshot?: boolean }) {
  const response = await apiClient.post<CameraDiagnostic>(`/api/cameras/${cameraId}/diagnose`, undefined, {
    params: {
      save_snapshot: params?.saveSnapshot ?? true,
    },
  });
  return response.data;
}
