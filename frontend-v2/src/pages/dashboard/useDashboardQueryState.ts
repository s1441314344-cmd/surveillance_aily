import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardAnomalies,
  listDashboardDefinitions,
  getDashboardSummary,
  getDashboardTrends,
} from '@/shared/api/dashboard';
import { listModelProviders } from '@/shared/api/modelProviders';
import { listStrategies } from '@/shared/api/strategies';
import { type MetricEntry } from '@/pages/insights/MetricsGrid';
import { type TrendPoint } from '@/pages/insights/TrendPanel';
import { dateLabel } from '@/pages/dashboard/types';
import {
  buildDashboardQueryKey,
  buildDashboardQueryParams,
  mapSummaryToMetricEntries,
  type DashboardQueryFilters,
} from './dashboardQueryHelpers';

type UseDashboardQueryStateParams = {
  strategyFilter: string;
  modelProviderFilter: string;
  anomalyTypeFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  selectedDashboardId: string;
};

export function useDashboardQueryState({
  strategyFilter,
  modelProviderFilter,
  anomalyTypeFilter,
  dateFromFilter,
  dateToFilter,
  selectedDashboardId,
}: UseDashboardQueryStateParams) {
  const filters = useMemo<DashboardQueryFilters>(
    () => ({
      strategyFilter,
      modelProviderFilter,
      anomalyTypeFilter,
      dateFromFilter,
      dateToFilter,
    }),
    [strategyFilter, modelProviderFilter, anomalyTypeFilter, dateFromFilter, dateToFilter],
  );
  const queryParams = useMemo(
    () => buildDashboardQueryParams(filters),
    [filters],
  );

  const dashboardDefinitionsQuery = useQuery({
    queryKey: ['dashboard-definitions', 'active-for-dashboard'],
    queryFn: () => listDashboardDefinitions({ status: 'active' }),
  });

  const strategyListQuery = useQuery({
    queryKey: ['strategies', 'all-for-dashboard'],
    queryFn: () => listStrategies(),
  });

  const modelProviderQuery = useQuery({
    queryKey: ['model-providers', 'all-for-dashboard'],
    queryFn: () => listModelProviders(),
  });

  const summaryQuery = useQuery({
    queryKey: buildDashboardQueryKey('summary', filters),
    queryFn: () => getDashboardSummary(queryParams),
    refetchInterval: 15000,
  });

  const trendsQuery = useQuery({
    queryKey: buildDashboardQueryKey('trends', filters),
    queryFn: () => getDashboardTrends(queryParams),
    refetchInterval: 15000,
  });

  const anomaliesQuery = useQuery({
    queryKey: buildDashboardQueryKey('anomalies', filters),
    queryFn: () => getDashboardAnomalies(queryParams),
    refetchInterval: 15000,
  });

  const activeDashboardDefinition = useMemo(() => {
    const definitions = dashboardDefinitionsQuery.data ?? [];
    if (!definitions.length) {
      return null;
    }

    if (selectedDashboardId !== 'auto') {
      return definitions.find((item) => item.id === selectedDashboardId) ?? null;
    }

    return definitions.find((item) => item.is_default) ?? definitions[0];
  }, [dashboardDefinitionsQuery.data, selectedDashboardId]);

  const summary = summaryQuery.data;
  const anomalies = anomaliesQuery.data ?? [];

  const trendPoints: TrendPoint[] = (trendsQuery.data ?? []).map((point) => ({
    label: dateLabel(point.date),
    value: point.total_jobs,
  }));

  const metricItems = useMemo<MetricEntry[]>(() => mapSummaryToMetricEntries(summary), [summary]);

  const dashboardError =
    dashboardDefinitionsQuery.error ||
    summaryQuery.error ||
    trendsQuery.error ||
    anomaliesQuery.error;

  return {
    dashboardDefinitionsQuery,
    strategyListQuery,
    modelProviderQuery,
    summaryQuery,
    trendsQuery,
    anomaliesQuery,
    activeDashboardDefinition,
    anomalies,
    trendPoints,
    metricItems,
    dashboardError,
  };
}
