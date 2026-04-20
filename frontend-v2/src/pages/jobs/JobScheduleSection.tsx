import { Button, Select } from 'antd';
import { FilterToolbar, SectionCard } from '@/shared/ui';
import { ScheduleTable } from '@/pages/jobs/ScheduleTable';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';

type JobScheduleSectionFilterValuesProps = {
  scheduleStatusFilter: string;
  scheduleCameraFilter: string;
  scheduleStrategyFilter: string;
};

type JobScheduleSectionFilterOptionsProps = {
  statusOptions: readonly OptionItem[];
  cameraOptions: readonly OptionItem[];
  strategyOptions: readonly OptionItem[];
};

type JobScheduleSectionFilterHandlersProps = {
  onScheduleStatusFilterChange: (value: string) => void;
  onScheduleCameraFilterChange: (value: string) => void;
  onScheduleStrategyFilterChange: (value: string) => void;
  onResetFilters: () => void;
};

type JobScheduleSectionFiltersProps = {
  values: JobScheduleSectionFilterValuesProps;
  options: JobScheduleSectionFilterOptionsProps;
  handlers: JobScheduleSectionFilterHandlersProps;
};

type JobScheduleSectionProps = {
  filters: JobScheduleSectionFiltersProps;
  table: Parameters<typeof ScheduleTable>[0];
};

export function JobScheduleSection({ filters, table }: JobScheduleSectionProps) {
  return (
    <SectionCard title="定时任务计划" subtitle="管理计划启停、编辑和立即触发">
      <FilterToolbar dense title="计划筛选" description="按状态、摄像头和策略快速过滤定时计划">
        <Select
          size="small"
          data-testid="schedule-filter-status"
          value={filters.values.scheduleStatusFilter}
          onChange={filters.handlers.onScheduleStatusFilterChange}
          options={[...filters.options.statusOptions]}
          className="page-toolbar-field"
        />
        <Select
          size="small"
          data-testid="schedule-filter-camera"
          value={filters.values.scheduleCameraFilter}
          onChange={filters.handlers.onScheduleCameraFilterChange}
          options={[...filters.options.cameraOptions]}
          className="page-toolbar-field page-toolbar-field--md"
        />
        <Select
          size="small"
          data-testid="schedule-filter-strategy"
          value={filters.values.scheduleStrategyFilter}
          onChange={filters.handlers.onScheduleStrategyFilterChange}
          options={[...filters.options.strategyOptions]}
          className="page-toolbar-field page-toolbar-field--md"
        />
        <Button size="small" onClick={filters.handlers.onResetFilters}>
          重置筛选
        </Button>
      </FilterToolbar>

      <ScheduleTable {...table} />
    </SectionCard>
  );
}
