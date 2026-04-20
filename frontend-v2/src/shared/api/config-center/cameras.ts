import { apiClient } from '../client';

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

export type CameraMedia = {
  id: string;
  camera_id: string;
  related_job_id: string | null;
  file_asset_id: string | null;
  media_type: 'photo' | 'video' | string;
  source_kind: string;
  status: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  duration_seconds: number | null;
  stop_requested: boolean;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CameraPhotoCaptureResult = {
  camera_id: string;
  success: boolean;
  media: CameraMedia | null;
  error_message: string | null;
};

export type CameraRecordingResult = {
  camera_id: string;
  success: boolean;
  media: CameraMedia;
  message: string | null;
};

export type CameraTriggerRule = {
  id: string;
  camera_id: string;
  name: string;
  event_type: 'person' | 'fire' | 'leak' | 'custom' | string;
  event_key: string | null;
  enabled: boolean;
  min_confidence: number;
  min_consecutive_frames: number;
  cooldown_seconds: number;
  description: string | null;
  last_triggered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CameraTriggerRulePayload = {
  name: string;
  event_type: 'person' | 'fire' | 'leak' | 'custom' | string;
  event_key?: string | null;
  enabled: boolean;
  min_confidence: number;
  min_consecutive_frames: number;
  cooldown_seconds: number;
  description?: string | null;
};

export type CameraTriggerRuleDebugPayload = {
  signals: Record<string, number>;
  consecutive_hits?: Record<string, number>;
  dry_run?: boolean;
  capture_on_match?: boolean;
  source_kind?: string;
  rule_ids?: string[];
};

export type CameraTriggerRuleDebugItem = {
  rule_id: string;
  rule_name: string;
  event_type: string;
  event_key: string;
  enabled: boolean;
  matched: boolean;
  confidence: number;
  threshold: number;
  consecutive_hits: number;
  required_consecutive_hits: number;
  cooldown_ok: boolean;
  cooldown_remaining_seconds: number;
  reason: string;
  media: CameraMedia | null;
  error_message: string | null;
};

export type CameraTriggerRuleDebugResult = {
  camera_id: string;
  dry_run: boolean;
  capture_on_match: boolean;
  matched_count: number;
  evaluated_at: string;
  results: CameraTriggerRuleDebugItem[];
};

export type SignalMonitorConfig = {
  camera_id: string;
  runtime_mode: 'daemon' | 'manual' | 'schedule';
  enabled: boolean;
  signal_strategy_id: string | null;
  strict_local_gate: boolean;
  monitor_interval_seconds: number;
  schedule_type: 'interval_minutes' | 'daily_time' | null;
  schedule_value: string | null;
  manual_until: string | null;
  roi_enabled: boolean;
  roi_x: number | null;
  roi_y: number | null;
  roi_width: number | null;
  roi_height: number | null;
  roi_shape: 'rect' | 'polygon' | string;
  roi_points: Array<{ x: number; y: number }> | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SignalMonitorConfigPayload = {
  runtime_mode?: 'daemon' | 'manual' | 'schedule';
  enabled?: boolean;
  signal_strategy_id?: string | null;
  strict_local_gate?: boolean;
  monitor_interval_seconds?: number;
  schedule_type?: 'interval_minutes' | 'daily_time' | null;
  schedule_value?: string | null;
  manual_until?: string | null;
  roi_enabled?: boolean;
  roi_x?: number | null;
  roi_y?: number | null;
  roi_width?: number | null;
  roi_height?: number | null;
  roi_shape?: 'rect' | 'polygon' | string;
  roi_points?: Array<{ x: number; y: number }> | null;
};

export type DebugLivePayload = {
  detected_signals: Record<string, number>;
  source_kind?: string;
  include_results?: boolean;
};

export type DebugLiveResult = {
  camera_id: string;
  detected_signals: Record<string, number>;
  matched_count: number;
  results: Array<Record<string, unknown>>;
  evaluated_at: string | null;
};

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

export async function captureCameraPhoto(cameraId: string, payload?: { sourceKind?: string }) {
  const response = await apiClient.post<CameraPhotoCaptureResult>(`/api/cameras/${cameraId}/capture-photo`, {
    source_kind: payload?.sourceKind || 'manual',
  }, {
    timeout: 60000,
  });
  return response.data;
}

export async function startCameraRecording(
  cameraId: string,
  payload: { durationSeconds: number; sourceKind?: string },
) {
  const response = await apiClient.post<CameraRecordingResult>(`/api/cameras/${cameraId}/recordings/start`, {
    duration_seconds: payload.durationSeconds,
    source_kind: payload.sourceKind || 'manual',
  }, {
    timeout: 60000,
  });
  return response.data;
}

export async function stopCameraRecording(cameraId: string, mediaId: string) {
  const response = await apiClient.post<CameraRecordingResult>(`/api/cameras/${cameraId}/recordings/${mediaId}/stop`, undefined, {
    timeout: 30000,
  });
  return response.data;
}

export async function listCameraMedia(cameraId: string, params?: { mediaType?: string; limit?: number }) {
  const response = await apiClient.get<CameraMedia[]>(`/api/cameras/${cameraId}/media`, {
    params: {
      media_type: params?.mediaType || undefined,
      limit: params?.limit ?? 50,
    },
  });
  return response.data;
}

export async function listCameraTriggerRules(cameraId: string) {
  const response = await apiClient.get<CameraTriggerRule[]>(`/api/cameras/${cameraId}/trigger-rules`);
  return response.data;
}

export async function createCameraTriggerRule(cameraId: string, payload: CameraTriggerRulePayload) {
  const response = await apiClient.post<CameraTriggerRule>(`/api/cameras/${cameraId}/trigger-rules`, payload);
  return response.data;
}

export async function updateCameraTriggerRule(
  cameraId: string,
  ruleId: string,
  payload: Partial<CameraTriggerRulePayload>,
) {
  const response = await apiClient.patch<CameraTriggerRule>(
    `/api/cameras/${cameraId}/trigger-rules/${ruleId}`,
    payload,
  );
  return response.data;
}

export async function deleteCameraTriggerRule(cameraId: string, ruleId: string) {
  const response = await apiClient.delete<{ deleted: boolean }>(
    `/api/cameras/${cameraId}/trigger-rules/${ruleId}`,
  );
  return response.data;
}

export async function debugCameraTriggerRules(
  cameraId: string,
  payload: CameraTriggerRuleDebugPayload,
) {
  const response = await apiClient.post<CameraTriggerRuleDebugResult>(
    `/api/cameras/${cameraId}/trigger-rules/debug`,
    payload,
    {
      timeout: 60000,
    },
  );
  return response.data;
}

export async function getSignalMonitorConfig(cameraId: string) {
  const response = await apiClient.get<SignalMonitorConfig>(`/api/cameras/${cameraId}/signal-monitor-config`);
  return response.data;
}

export async function updateSignalMonitorConfig(cameraId: string, payload: SignalMonitorConfigPayload) {
  const response = await apiClient.patch<SignalMonitorConfig>(`/api/cameras/${cameraId}/signal-monitor-config`, payload);
  return response.data;
}

export async function debugCameraLive(
  cameraId: string,
  payload: DebugLivePayload,
) {
  const response = await apiClient.post<DebugLiveResult>(
    `/api/cameras/${cameraId}/debug-live`,
    payload,
    { timeout: 60000 },
  );
  return response.data;
}

export async function fetchCameraMediaFile(cameraId: string, mediaId: string) {
  const response = await apiClient.get<Blob>(`/api/cameras/${cameraId}/media/${mediaId}/file`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteCameraMedia(cameraId: string, mediaId: string) {
  const response = await apiClient.delete<{ deleted: boolean }>(`/api/cameras/${cameraId}/media/${mediaId}`);
  return response.data;
}
