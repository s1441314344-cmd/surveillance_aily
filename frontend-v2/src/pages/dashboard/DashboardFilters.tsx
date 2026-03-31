import { Button, Input, Select, Space } from 'antd';
import { FilterToolbar } from '@/shared/ui';
import type { ChangeEvent } from 'react';

type OptionItem = {
  label: string;
  value: string;
};

type DashboardFiltersProps = {
  selectedDashboardId: string;
  dashboardOptions: OptionItem[];
  strategyFilter: string;
  strategyOptions: OptionItem[];
  modelProviderFilter: string;
  modelProviderOptions: OptionItem[];
  anomalyTypeFilter: string;
  anomalyTypeOptions: OptionItem[];
  dateFromFilter: string;
  dateToFilter: string;
  disableApplyPreset: boolean;
  onSelectedDashboardIdChange: (value: string) => void;
  onStrategyFilterChange: (value: string) => void;
  onModelProviderFilterChange: (value: string) => void;
  onAnomalyTypeFilterChange: (value: string) => void;
  onDateFromFilterChange: (value: string) => void;
  onDateToFilterChange: (value: string) => void;
  onApplyPreset: () => void;
  onResetFilters: () => void;
};

export function DashboardFilters({
  selectedDashboardId,
  dashboardOptions,
  strategyFilter,
  strategyOptions,
  modelProviderFilter,
  modelProviderOptions,
  anomalyTypeFilter,
  anomalyTypeOptions,
  dateFromFilter,
  dateToFilter,
  disableApplyPreset,
  onSelectedDashboardIdChange,
  onStrategyFilterChange,
  onModelProviderFilterChange,
  onAnomalyTypeFilterChange,
  onDateFromFilterChange,
  onDateToFilterChange,
  onApplyPreset,
  onResetFilters,
}: DashboardFiltersProps) {
  const actions = (
    <Space wrap size={8}>
      <Button
        type="text"
        onClick={onApplyPreset}
        disabled={disableApplyPreset}
        data-testid="dashboard-apply-preset"
      >
        应用看板预设
      </Button>
      <Button onClick={onResetFilters}>
        重置筛选
      </Button>
    </Space>
  );
  const handleDateFromChange = (event: ChangeEvent<HTMLInputElement>) => onDateFromFilterChange(event.target.value);
  const handleDateToChange = (event: ChangeEvent<HTMLInputElement>) => onDateToFilterChange(event.target.value);

  return (
    <FilterToolbar
      actions={actions}
    >
      <Select
        data-testid="dashboard-filter-dashboard"
        value={selectedDashboardId}
        onChange={onSelectedDashboardIdChange}
        className="page-toolbar-field page-toolbar-field--md"
        options={dashboardOptions}
      />
      <Select
        data-testid="dashboard-filter-strategy"
        value={strategyFilter}
        onChange={onStrategyFilterChange}
        className="page-toolbar-field page-toolbar-field--lg"
        options={strategyOptions}
      />
      <Select
        data-testid="dashboard-filter-provider"
        value={modelProviderFilter}
        onChange={onModelProviderFilterChange}
        className="page-toolbar-field page-toolbar-field--md"
        options={modelProviderOptions}
      />
      <Select
        data-testid="dashboard-filter-anomaly"
        value={anomalyTypeFilter}
        onChange={onAnomalyTypeFilterChange}
        className="page-toolbar-field page-toolbar-field--md"
        options={anomalyTypeOptions}
      />
      <Input
        data-testid="dashboard-filter-date-from"
        type="date"
        value={dateFromFilter}
        onChange={handleDateFromChange}
        placeholder="开始时间"
        className="page-toolbar-field"
      />
      <Input
        data-testid="dashboard-filter-date-to"
        type="date"
        value={dateToFilter}
        onChange={handleDateToChange}
        placeholder="结束时间"
        className="page-toolbar-field"
      />
    </FilterToolbar>
  );
}
