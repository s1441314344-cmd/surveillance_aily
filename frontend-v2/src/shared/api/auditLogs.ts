import { apiClient } from './client';

export type AuditLog = {
  id: string;
  operator_user_id: string | null;
  operator_username: string | null;
  http_method: string;
  request_path: string;
  status_code: number;
  success: boolean;
  duration_ms: number;
  client_ip: string | null;
  user_agent: string | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
};

export async function listAuditLogs(params?: {
  httpMethod?: string;
  requestPath?: string;
  operatorUsername?: string;
  success?: boolean;
  statusCode?: number;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
}) {
  const response = await apiClient.get<AuditLog[]>('/api/audit-logs', {
    params: {
      http_method: params?.httpMethod || undefined,
      request_path: params?.requestPath || undefined,
      operator_username: params?.operatorUsername || undefined,
      success: params?.success,
      status_code: params?.statusCode,
      created_from: params?.createdFrom || undefined,
      created_to: params?.createdTo || undefined,
      limit: params?.limit ?? 200,
    },
  });
  return response.data;
}
