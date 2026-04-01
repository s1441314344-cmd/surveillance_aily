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

export type TrainingOverview = {
  reviewed_samples: number;
  candidate_samples: number;
  pending_release_requests: number;
  last_run_id: string | null;
  last_run_status: string | null;
  last_run_at: string | null;
  last_error: string | null;
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

export type AlertRecord = {
  id: string;
  camera_id: string | null;
  camera_name: string | null;
  alert_type: string;
  severity: string;
  status: string;
  title: string;
  message: string | null;
  detected_signals: Record<string, number> | null;
  matched_count: number | null;
  results: Array<Record<string, unknown>> | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AlertRecordWire = {
  id: string;
  camera_id: string | null;
  rule_id: string | null;
  rule_name: string | null;
  event_key: string;
  confidence: number;
  status: string;
  message: string | null;
  media_id: string | null;
  payload: Record<string, unknown> | null;
  occurred_at: string | null;
  acked_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AlertWebhook = {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  events: string[];
  headers: Record<string, string> | null;
  secret_masked: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_error: string | null;
  last_delivered_at: string | null;
};

export type AlertWebhookPayload = {
  name: string;
  endpoint: string;
  enabled?: boolean;
  events?: string[];
  headers?: Record<string, string>;
  secret?: string;
};

type AlertWebhookWire = {
  id: string;
  name: string;
  url: string;
  status: string;
  timeout_seconds: number;
  has_secret: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function mapAlertWebhookWire(data: AlertWebhookWire): AlertWebhook {
  return {
    id: data.id,
    name: data.name,
    endpoint: data.url,
    enabled: data.status === 'active',
    events: ['alert.created'],
    headers: null,
    secret_masked: data.has_secret ? '********' : null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    last_error: null,
    last_delivered_at: null,
  };
}

function mapAlertRecordWire(data: AlertRecordWire): AlertRecord {
  const payload = data.payload && typeof data.payload === 'object' ? data.payload : null;
  const payloadSeverity =
    payload && typeof payload.severity === 'string' ? payload.severity : undefined;
  const inferredSeverity =
    data.confidence >= 0.9 ? 'critical' : data.confidence >= 0.7 ? 'high' : 'medium';
  const severity = payloadSeverity || inferredSeverity;
  const mappedStatus = data.status === 'acked' ? 'acknowledged' : data.status;

  return {
    id: data.id,
    camera_id: data.camera_id,
    camera_name:
      payload && typeof payload.camera_name === 'string'
        ? payload.camera_name
        : null,
    alert_type: data.event_key,
    severity,
    status: mappedStatus,
    title: data.rule_name || data.event_key || '告警事件',
    message: data.message,
    detected_signals:
      payload && payload.detected_signals && typeof payload.detected_signals === 'object'
        ? (payload.detected_signals as Record<string, number>)
        : null,
    matched_count:
      payload && typeof payload.matched_count === 'number'
        ? payload.matched_count
        : null,
    results:
      payload && Array.isArray(payload.results)
        ? (payload.results as Array<Record<string, unknown>>)
        : null,
    acknowledged_at: data.acked_at,
    acknowledged_by: null,
    resolved_at: data.resolved_at,
    resolved_by: null,
    created_at: data.created_at || data.occurred_at,
    updated_at: data.updated_at,
  };
}

export type DashboardDefinition = {
  id: string;
  name: string;
  description: string | null;
  definition: Record<string, unknown>;
  status: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type DashboardDefinitionPayload = {
  name: string;
  description?: string | null;
  definition: Record<string, unknown>;
  status: string;
  is_default: boolean;
};

export type DashboardDefinitionValidationResponse = {
  dashboard_id: string | null;
  valid: boolean;
  errors: string[];
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

export async function listAlerts(params?: {
  cameraId?: string;
  status?: string;
  severity?: string;
  keyword?: string;
}) {
  const response = await apiClient.get<AlertRecordWire[]>('/api/alerts', {
    params: {
      camera_id: params?.cameraId || undefined,
      status: params?.status || undefined,
      severity: params?.severity || undefined,
      keyword: params?.keyword || undefined,
    },
  });
  return response.data.map(mapAlertRecordWire);
}

export async function ackAlert(alertId: string) {
  const response = await apiClient.post<AlertRecordWire>(`/api/alerts/${alertId}/ack`);
  return mapAlertRecordWire(response.data);
}

export async function resolveAlert(alertId: string) {
  const response = await apiClient.post<AlertRecordWire>(`/api/alerts/${alertId}/resolve`);
  return mapAlertRecordWire(response.data);
}

export async function listAlertWebhooks() {
  const response = await apiClient.get<AlertWebhookWire[]>('/api/alert-webhooks');
  return response.data.map(mapAlertWebhookWire);
}

export async function createAlertWebhook(payload: AlertWebhookPayload) {
  const response = await apiClient.post<AlertWebhookWire>('/api/alert-webhooks', {
    name: payload.name,
    url: payload.endpoint,
    status: payload.enabled === false ? 'inactive' : 'active',
    timeout_seconds: 5,
    secret: payload.secret,
  });
  return mapAlertWebhookWire(response.data);
}

export async function updateAlertWebhook(webhookId: string, payload: Partial<AlertWebhookPayload>) {
  const response = await apiClient.patch<AlertWebhookWire>(`/api/alert-webhooks/${webhookId}`, {
    name: payload.name,
    url: payload.endpoint,
    status: payload.enabled === undefined ? undefined : payload.enabled ? 'active' : 'inactive',
    secret: payload.secret,
  });
  return mapAlertWebhookWire(response.data);
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

export async function listDashboardDefinitions(params?: { status?: string }) {
  const response = await apiClient.get<DashboardDefinition[]>('/api/dashboards', {
    params: {
      status: params?.status || undefined,
    },
  });
  return response.data;
}

export async function createDashboardDefinition(payload: DashboardDefinitionPayload) {
  const response = await apiClient.post<DashboardDefinition>('/api/dashboards', payload);
  return response.data;
}

export async function updateDashboardDefinition(
  dashboardId: string,
  payload: Partial<DashboardDefinitionPayload>,
) {
  const response = await apiClient.patch<DashboardDefinition>(`/api/dashboards/${dashboardId}`, payload);
  return response.data;
}

export async function deleteDashboardDefinition(dashboardId: string) {
  const response = await apiClient.delete<{ deleted: boolean }>(`/api/dashboards/${dashboardId}`);
  return response.data;
}

export async function validateDashboardDefinition(dashboardId: string, definition: Record<string, unknown>) {
  const response = await apiClient.post<DashboardDefinitionValidationResponse>(
    `/api/dashboards/${dashboardId}/validate-definition`,
    { definition },
  );
  return response.data;
}

export async function validateDashboardDefinitionDraft(definition: Record<string, unknown>) {
  const response = await apiClient.post<DashboardDefinitionValidationResponse>('/api/dashboards/validate-definition', {
    definition,
  });
  return response.data;
}
