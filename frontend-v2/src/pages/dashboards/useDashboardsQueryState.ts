import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDashboardDefinitions } from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import { CREATE_DASHBOARD_ID } from '@/pages/dashboards/types';
import { DASHBOARDS_QUERY_KEYS } from '@/pages/dashboards/dashboardsQueryKeys';
import { getEffectiveSelectionId } from '@/shared/utils/effectiveSelection';

type UseDashboardsQueryStateParams = {
  statusFilter: string;
  selectedDashboardId: string | null;
};

export function useDashboardsQueryState({
  statusFilter,
  selectedDashboardId,
}: UseDashboardsQueryStateParams) {
  const dashboardQuery = useQuery({
    queryKey: DASHBOARDS_QUERY_KEYS.definitionsByStatus(statusFilter),
    queryFn: () =>
      listDashboardDefinitions({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const dashboards = useMemo(() => dashboardQuery.data ?? [], [dashboardQuery.data]);
  const effectiveSelectedDashboardId = useMemo(() => {
    if (selectedDashboardId === CREATE_DASHBOARD_ID) {
      return null;
    }
    return getEffectiveSelectionId({
      items: dashboards,
      selectedId: selectedDashboardId,
      getId: (item) => item.id,
    });
  }, [dashboards, selectedDashboardId]);

  const activeDashboard = useMemo(
    () => dashboards.find((item) => item.id === effectiveSelectedDashboardId) ?? null,
    [dashboards, effectiveSelectedDashboardId],
  );

  const dashboardError = dashboardQuery.error
    ? getApiErrorMessage(dashboardQuery.error, '看板定义加载失败')
    : null;

  return {
    dashboardQuery,
    dashboards,
    effectiveSelectedDashboardId,
    activeDashboard,
    dashboardError,
  };
}
