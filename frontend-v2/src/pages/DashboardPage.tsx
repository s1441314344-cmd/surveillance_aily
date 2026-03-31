import { DataStateBlock, PageHeader, SectionCard } from '@/shared/ui';
import { MetricsGrid } from '@/pages/insights/MetricsGrid';
import { TrendPanel } from '@/pages/insights/TrendPanel';
import { AnomalyTable } from '@/pages/insights/AnomalyTable';
import { getApiErrorMessage } from '@/shared/api/errors';
import { DashboardFilters } from '@/pages/dashboard/DashboardFilters';
import { useDashboardPageController } from '@/pages/dashboard/useDashboardPageController';

export function DashboardPage() {
  const {
    filters,
    queries,
    dashboardOptions,
    strategyOptions,
    modelProviderOptions,
    anomalyTypeOptions,
    anomalyRows,
    handleDashboardPreset,
    handleResetFilters,
  } = useDashboardPageController();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="数据概览"
        title="总览看板"
        description="按任务、记录与复核数据呈现关键指标、趋势与异常案例。"
      />

      <SectionCard title="筛选条件" subtitle="按策略、模型提供方、时间与异常类型快速定位数据">
        <DashboardFilters
          selectedDashboardId={filters.selectedDashboardId}
          dashboardOptions={dashboardOptions}
          strategyFilter={filters.strategyFilter}
          strategyOptions={strategyOptions}
          modelProviderFilter={filters.modelProviderFilter}
          modelProviderOptions={modelProviderOptions}
          anomalyTypeFilter={filters.anomalyTypeFilter}
          anomalyTypeOptions={anomalyTypeOptions}
          dateFromFilter={filters.dateFromFilter}
          dateToFilter={filters.dateToFilter}
          disableApplyPreset={!queries.activeDashboardDefinition}
          onSelectedDashboardIdChange={filters.setSelectedDashboardId}
          onStrategyFilterChange={filters.setStrategyFilter}
          onModelProviderFilterChange={filters.setModelProviderFilter}
          onAnomalyTypeFilterChange={filters.setAnomalyTypeFilter}
          onDateFromFilterChange={filters.setDateFromFilter}
          onDateToFilterChange={filters.setDateToFilter}
          onApplyPreset={handleDashboardPreset}
          onResetFilters={handleResetFilters}
        />
      </SectionCard>

      <SectionCard title="核心指标" subtitle="任务规模、结构化质量与反馈闭环概览">
        <MetricsGrid metrics={queries.metricItems} />
      </SectionCard>

      <TrendPanel title="任务趋势" points={queries.trendPoints} />

      <AnomalyTable
        data={anomalyRows}
        loading={queries.anomaliesQuery.isLoading}
      />

      {queries.dashboardError ? (
        <SectionCard title="加载状态">
          <DataStateBlock error={getApiErrorMessage(queries.dashboardError, '数据加载失败')} />
        </SectionCard>
      ) : null}
    </div>
  );
}
