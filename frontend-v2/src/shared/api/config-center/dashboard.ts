import { apiClient } from '../client';

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
