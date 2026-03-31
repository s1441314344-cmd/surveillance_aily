export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });

export const parseDateFilter = (value: string) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export type DashboardPresetFilters = {
  strategy_id?: string;
  model_provider?: string;
  anomaly_type?: string;
  time_range?: string;
};

export const isDashboardPresetFilters = (value: unknown): value is DashboardPresetFilters =>
  Boolean(value) && typeof value === 'object';

export const formatDateInput = (value: string | Date) => {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export type DashboardFilterState = {
  strategyFilter: string;
  modelProviderFilter: string;
  anomalyTypeFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  selectedDashboardId: string;
};
