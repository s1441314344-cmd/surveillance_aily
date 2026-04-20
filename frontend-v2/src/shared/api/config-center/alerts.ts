import { apiClient } from '../client';

export type AlertRecord = {
  id: string;
  camera_id: string | null;
  camera_name: string | null;
  strategy_id: string | null;
  strategy_name: string | null;
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
  strategy_id?: string | null;
  strategy_name?: string | null;
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

export type AlertNotificationRoute = {
  id: string;
  name: string;
  strategy_id: string | null;
  strategy_name: string | null;
  event_key: string | null;
  severity: string | null;
  camera_id: string | null;
  recipient_type: 'user' | 'chat';
  recipient_id: string;
  enabled: boolean;
  priority: number;
  cooldown_seconds: number;
  message_template: string | null;
  last_error: string | null;
  last_delivered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AlertNotificationRoutePayload = {
  name: string;
  strategy_id?: string | null;
  event_key?: string | null;
  severity?: string | null;
  camera_id?: string | null;
  recipient_type: 'user' | 'chat';
  recipient_id: string;
  enabled?: boolean;
  priority?: number;
  cooldown_seconds?: number;
  message_template?: string | null;
};

export type AlertFeishuUserCandidate = {
  id: string;
  open_id: string;
  user_id: string | null;
  employee_id: string | null;
  name: string;
  avatar_url: string | null;
  department_ids: string[];
};

export type AlertFeishuUserSearchResult = {
  items: AlertFeishuUserCandidate[];
  has_more: boolean;
  page_token: string | null;
};

export type AlertFeishuChatCandidate = {
  id: string;
  chat_id: string;
  name: string;
  avatar_url: string | null;
  description: string | null;
  owner_open_id: string | null;
  external: boolean;
};

export type AlertFeishuChatSearchResult = {
  items: AlertFeishuChatCandidate[];
  has_more: boolean;
  page_token: string | null;
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

type AlertNotificationRouteWire = AlertNotificationRoute;

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
    strategy_id:
      typeof data.strategy_id === 'string'
        ? data.strategy_id
        : payload && typeof payload.strategy_id === 'string'
          ? payload.strategy_id
          : null,
    strategy_name:
      typeof data.strategy_name === 'string'
        ? data.strategy_name
        : payload && typeof payload.strategy_name === 'string'
          ? payload.strategy_name
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

export async function listAlertNotificationRoutes(params?: {
  strategyId?: string;
  enabled?: boolean;
}) {
  const response = await apiClient.get<AlertNotificationRouteWire[]>('/api/alert-notification-routes', {
    params: {
      strategy_id: params?.strategyId || undefined,
      enabled: params?.enabled,
    },
  });
  return response.data;
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

export async function createAlertNotificationRoute(payload: AlertNotificationRoutePayload) {
  const response = await apiClient.post<AlertNotificationRouteWire>('/api/alert-notification-routes', payload);
  return response.data;
}

export async function updateAlertNotificationRoute(
  routeId: string,
  payload: Partial<AlertNotificationRoutePayload>,
) {
  const response = await apiClient.patch<AlertNotificationRouteWire>(
    `/api/alert-notification-routes/${routeId}`,
    payload,
  );
  return response.data;
}

export async function searchAlertFeishuUsers(params: {
  keyword: string;
  limit?: number;
  pageToken?: string;
}) {
  const response = await apiClient.get<AlertFeishuUserSearchResult>(
    '/api/alert-notification-routes/recipients/users/search',
    {
      params: {
        keyword: params.keyword,
        limit: params.limit ?? 20,
        page_token: params.pageToken || undefined,
      },
    },
  );
  return response.data;
}

export async function searchAlertFeishuChats(params?: {
  keyword?: string;
  limit?: number;
  pageToken?: string;
}) {
  const response = await apiClient.get<AlertFeishuChatSearchResult>(
    '/api/alert-notification-routes/recipients/chats/search',
    {
      params: {
        keyword: params?.keyword?.trim() || undefined,
        limit: params?.limit ?? 20,
        page_token: params?.pageToken || undefined,
      },
    },
  );
  return response.data;
}
