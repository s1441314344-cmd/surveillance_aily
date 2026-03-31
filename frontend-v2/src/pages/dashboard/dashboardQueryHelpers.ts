import type { DashboardSummary } from '@/shared/api/dashboard';
import type { MetricEntry } from '@/pages/insights/MetricsGrid';
import { parseDateFilter } from './types';

export type DashboardQueryFilters = {
  strategyFilter: string;
  modelProviderFilter: string;
  anomalyTypeFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
};

export function buildDashboardQueryKey(scope: string, filters: DashboardQueryFilters) {
  return [
    'dashboard',
    scope,
    filters.strategyFilter,
    filters.modelProviderFilter,
    filters.anomalyTypeFilter,
    filters.dateFromFilter,
    filters.dateToFilter,
  ];
}

export function buildDashboardQueryParams(filters: DashboardQueryFilters) {
  return {
    strategyId: filters.strategyFilter === 'all' ? undefined : filters.strategyFilter,
    modelProvider: filters.modelProviderFilter === 'all' ? undefined : filters.modelProviderFilter,
    anomalyType: filters.anomalyTypeFilter === 'all' ? undefined : filters.anomalyTypeFilter,
    createdFrom: parseDateFilter(filters.dateFromFilter),
    createdTo: parseDateFilter(filters.dateToFilter),
  };
}

export function mapSummaryToMetricEntries(summary?: DashboardSummary): MetricEntry[] {
  const base: DashboardSummary = {
    total_jobs: summary?.total_jobs ?? 0,
    total_records: summary?.total_records ?? 0,
    pending_review_count: summary?.pending_review_count ?? 0,
    schema_invalid_count: summary?.schema_invalid_count ?? 0,
    success_rate: summary?.success_rate ?? 0,
    anomaly_rate: summary?.anomaly_rate ?? 0,
    structured_success_rate: summary?.structured_success_rate ?? 0,
    schema_invalid_rate: summary?.schema_invalid_rate ?? 0,
    reviewed_rate: summary?.reviewed_rate ?? 0,
    confirmed_accuracy_rate: summary?.confirmed_accuracy_rate ?? 0,
  };

  return [
    { title: '任务总数', value: base.total_jobs, tone: 'primary' },
    { title: '记录总数', value: base.total_records, tone: 'primary' },
    { title: '已复核率', value: `${base.reviewed_rate.toFixed(1)}%`, tone: 'success' },
    { title: '结构化成功率', value: `${base.structured_success_rate.toFixed(1)}%`, tone: 'success' },
    { title: '准确率', value: `${base.confirmed_accuracy_rate.toFixed(1)}%`, tone: 'success' },
    { title: '异常率', value: `${base.anomaly_rate.toFixed(1)}%`, suffix: '', tone: 'warning' },
    { title: '结构化异常数', value: base.schema_invalid_count, tone: 'warning' },
    { title: '待复核', value: base.pending_review_count, tone: 'primary' },
  ];
}
