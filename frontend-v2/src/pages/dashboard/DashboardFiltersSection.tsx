import { SectionCard } from '@/shared/ui';
import { DashboardFilters } from '@/pages/dashboard/DashboardFilters';
import type { useDashboardPageController } from '@/pages/dashboard/useDashboardPageController';

type DashboardPageController = ReturnType<typeof useDashboardPageController>;

type DashboardFiltersSectionProps = {
  controller: DashboardPageController;
};

export function DashboardFiltersSection({ controller }: DashboardFiltersSectionProps) {
  return (
    <SectionCard title="筛选条件" subtitle="按策略、模型提供方、时间与异常类型快速定位数据">
      <DashboardFilters
        selectedDashboardId={controller.filters.selectedDashboardId}
        dashboardOptions={controller.dashboardOptions}
        strategyFilter={controller.filters.strategyFilter}
        strategyOptions={controller.strategyOptions}
        modelProviderFilter={controller.filters.modelProviderFilter}
        modelProviderOptions={controller.modelProviderOptions}
        anomalyTypeFilter={controller.filters.anomalyTypeFilter}
        anomalyTypeOptions={controller.anomalyTypeOptions}
        dateFromFilter={controller.filters.dateFromFilter}
        dateToFilter={controller.filters.dateToFilter}
        disableApplyPreset={!controller.queries.activeDashboardDefinition}
        onSelectedDashboardIdChange={controller.filters.setSelectedDashboardId}
        onStrategyFilterChange={controller.filters.setStrategyFilter}
        onModelProviderFilterChange={controller.filters.setModelProviderFilter}
        onAnomalyTypeFilterChange={controller.filters.setAnomalyTypeFilter}
        onDateFromFilterChange={controller.filters.setDateFromFilter}
        onDateToFilterChange={controller.filters.setDateToFilter}
        onApplyPreset={controller.handleDashboardPreset}
        onResetFilters={controller.handleResetFilters}
      />
    </SectionCard>
  );
}
