import type { QueryClient } from '@tanstack/react-query';
import type { MessageInstance } from 'antd/es/message/interface';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { DASHBOARDS_QUERY_KEYS } from '@/pages/dashboards/dashboardsQueryKeys';

export const invalidateDashboardQueries = async (queryClient: QueryClient, statusFilter: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: DASHBOARDS_QUERY_KEYS.definitionsRoot }),
    queryClient.invalidateQueries({ queryKey: DASHBOARDS_QUERY_KEYS.definitionsByStatus(statusFilter) }),
  ]);
};

export const createDashboardApiErrorHandler =
  (message: MessageInstance, fallback: string) => (error: unknown) => {
    message.error(getApiErrorMessage(error, fallback));
  };
