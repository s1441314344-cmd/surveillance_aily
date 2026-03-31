import { useCallback, useState } from 'react';
import { Form } from 'antd';
import { useDashboardsFormActionState } from '@/pages/dashboards/useDashboardsFormActionState';
import { useDashboardsMutationState } from '@/pages/dashboards/useDashboardsMutationState';
import { useDashboardsQueryState } from '@/pages/dashboards/useDashboardsQueryState';
import { type DashboardFormValues } from '@/pages/dashboards/types';

export function useDashboardsPageController() {
  const [form] = Form.useForm<DashboardFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  const queries = useDashboardsQueryState({
    statusFilter,
    selectedDashboardId,
  });

  const mutations = useDashboardsMutationState({
    statusFilter,
    onDashboardCreated: setSelectedDashboardId,
  });

  const actions = useDashboardsFormActionState({
    form,
    dashboardsCount: queries.dashboards.length,
    activeDashboard: queries.activeDashboard,
    effectiveSelectedDashboardId: queries.effectiveSelectedDashboardId,
    setSelectedDashboardId,
    mutations,
  });

  const handleResetListFilter = useCallback(() => {
    setStatusFilter('all');
  }, []);

  return {
    form,
    statusFilter,
    setStatusFilter,
    selectedDashboardId,
    setSelectedDashboardId,
    queries,
    mutations,
    actions,
    handleResetListFilter,
  };
}
