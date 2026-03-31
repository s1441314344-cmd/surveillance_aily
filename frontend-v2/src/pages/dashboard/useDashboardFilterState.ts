import { useCallback, useState } from 'react';

const DASHBOARD_FILTER_DEFAULTS = {
  strategyFilter: 'all',
  modelProviderFilter: 'all',
  anomalyTypeFilter: 'all',
  dateFromFilter: '',
  dateToFilter: '',
  selectedDashboardId: 'auto',
} as const;

export function useDashboardFilterState() {
  const [strategyFilter, setStrategyFilter] = useState<string>(DASHBOARD_FILTER_DEFAULTS.strategyFilter);
  const [modelProviderFilter, setModelProviderFilter] = useState<string>(DASHBOARD_FILTER_DEFAULTS.modelProviderFilter);
  const [anomalyTypeFilter, setAnomalyTypeFilter] = useState<string>(DASHBOARD_FILTER_DEFAULTS.anomalyTypeFilter);
  const [dateFromFilter, setDateFromFilter] = useState<string>(DASHBOARD_FILTER_DEFAULTS.dateFromFilter);
  const [dateToFilter, setDateToFilter] = useState<string>(DASHBOARD_FILTER_DEFAULTS.dateToFilter);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>(DASHBOARD_FILTER_DEFAULTS.selectedDashboardId);

  const resetFilters = useCallback(() => {
    setSelectedDashboardId(DASHBOARD_FILTER_DEFAULTS.selectedDashboardId);
    setStrategyFilter(DASHBOARD_FILTER_DEFAULTS.strategyFilter);
    setModelProviderFilter(DASHBOARD_FILTER_DEFAULTS.modelProviderFilter);
    setAnomalyTypeFilter(DASHBOARD_FILTER_DEFAULTS.anomalyTypeFilter);
    setDateFromFilter(DASHBOARD_FILTER_DEFAULTS.dateFromFilter);
    setDateToFilter(DASHBOARD_FILTER_DEFAULTS.dateToFilter);
  }, []);

  return {
    strategyFilter,
    setStrategyFilter,
    modelProviderFilter,
    setModelProviderFilter,
    anomalyTypeFilter,
    setAnomalyTypeFilter,
    dateFromFilter,
    setDateFromFilter,
    dateToFilter,
    setDateToFilter,
    selectedDashboardId,
    setSelectedDashboardId,
    resetFilters,
  };
}
