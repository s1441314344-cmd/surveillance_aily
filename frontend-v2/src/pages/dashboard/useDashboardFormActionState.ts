import { formatDateInput, isDashboardPresetFilters } from '@/pages/dashboard/types';
import type { DashboardDefinition } from '@/shared/api/configCenter';

type UseDashboardFormActionStateParams = {
  activeDashboardDefinition: DashboardDefinition | null;
  setStrategyFilter: (value: string) => void;
  setModelProviderFilter: (value: string) => void;
  setAnomalyTypeFilter: (value: string) => void;
  setDateFromFilter: (value: string) => void;
  setDateToFilter: (value: string) => void;
};

export function useDashboardFormActionState({
  activeDashboardDefinition,
  setStrategyFilter,
  setModelProviderFilter,
  setAnomalyTypeFilter,
  setDateFromFilter,
  setDateToFilter,
}: UseDashboardFormActionStateParams) {
  const handleDashboardPreset = () => {
    if (!activeDashboardDefinition) {
      return;
    }

    const maybeFilters =
      activeDashboardDefinition.definition &&
      typeof activeDashboardDefinition.definition === 'object' &&
      'filters' in activeDashboardDefinition.definition
        ? activeDashboardDefinition.definition.filters
        : undefined;

    const filterMap = isDashboardPresetFilters(maybeFilters) ? maybeFilters : {};
    setStrategyFilter(
      typeof filterMap.strategy_id === 'string' && filterMap.strategy_id ? filterMap.strategy_id : 'all',
    );
    setModelProviderFilter(
      typeof filterMap.model_provider === 'string' && filterMap.model_provider
        ? filterMap.model_provider
        : 'all',
    );
    setAnomalyTypeFilter(
      typeof filterMap.anomaly_type === 'string' && filterMap.anomaly_type ? filterMap.anomaly_type : 'all',
    );

    if (typeof filterMap.time_range === 'string') {
      setDateFromFilter(formatDateInput(new Date(Date.now() - 24 * 60 * 60 * 1000)));
      setDateToFilter(formatDateInput(new Date()));
    }
  };

  return {
    handleDashboardPreset,
  };
}
