import { useMemo } from 'react';
import { ANOMALY_TYPE_LABELS, buildAllOptions, FILTER_ALL_LABELS } from '@/shared/ui';
import { useDashboardFilterState } from '@/pages/dashboard/useDashboardFilterState';
import { useDashboardFormActionState } from '@/pages/dashboard/useDashboardFormActionState';
import { useDashboardQueryState } from '@/pages/dashboard/useDashboardQueryState';

export function useDashboardPageController() {
  const filters = useDashboardFilterState();
  const queries = useDashboardQueryState({
    strategyFilter: filters.strategyFilter,
    modelProviderFilter: filters.modelProviderFilter,
    anomalyTypeFilter: filters.anomalyTypeFilter,
    dateFromFilter: filters.dateFromFilter,
    dateToFilter: filters.dateToFilter,
    selectedDashboardId: filters.selectedDashboardId,
  });

  const { handleDashboardPreset } = useDashboardFormActionState({
    activeDashboardDefinition: queries.activeDashboardDefinition,
    setStrategyFilter: filters.setStrategyFilter,
    setModelProviderFilter: filters.setModelProviderFilter,
    setAnomalyTypeFilter: filters.setAnomalyTypeFilter,
    setDateFromFilter: filters.setDateFromFilter,
    setDateToFilter: filters.setDateToFilter,
  });

  const dashboardOptions = useMemo(
    () => [
      { label: '自动（默认看板）', value: 'auto' },
      ...(queries.dashboardDefinitionsQuery.data ?? []).map((item) => ({
        label: item.name,
        value: item.id,
      })),
    ],
    [queries.dashboardDefinitionsQuery.data],
  );

  const strategyOptions = useMemo(
    () =>
      buildAllOptions(queries.strategyListQuery.data, FILTER_ALL_LABELS.strategy, (item) => ({
        label: item.name,
        value: item.id,
      })),
    [queries.strategyListQuery.data],
  );

  const modelProviderOptions = useMemo(
    () =>
      buildAllOptions(queries.modelProviderQuery.data, FILTER_ALL_LABELS.provider, (item) => ({
        label: item.display_name || item.provider,
        value: item.provider,
      })),
    [queries.modelProviderQuery.data],
  );

  const anomalyTypeOptions = useMemo(
    () =>
      buildAllOptions(
        Object.entries(ANOMALY_TYPE_LABELS),
        FILTER_ALL_LABELS.anomaly,
        ([value, label]) => ({ label, value }),
      ),
    [],
  );

  const anomalyRows = useMemo(
    () =>
      queries.anomalies.map((item) => ({
        id: item.record_id,
        type: item.anomaly_type,
        status: item.result_status,
        strategy_name: item.strategy_name,
        model_name: '未提供模型信息',
        created_at: item.created_at,
        detail: item.summary,
      })),
    [queries.anomalies],
  );

  return {
    filters,
    queries,
    dashboardOptions,
    strategyOptions,
    modelProviderOptions,
    anomalyTypeOptions,
    anomalyRows,
    handleDashboardPreset,
    handleResetFilters: filters.resetFilters,
  };
}
