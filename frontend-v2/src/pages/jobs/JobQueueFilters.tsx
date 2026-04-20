import { Select } from 'antd';
import { FilterToolbar } from '@/shared/ui';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';

type JobQueueFilterValuesProps = {
  statusFilter: string;
  strategyFilter: string;
  triggerModeFilter: string;
  cameraFilter: string;
  scheduleFilter: string;
};

type JobQueueFilterOptionsProps = {
  statusOptions: readonly OptionItem[];
  strategyOptions: readonly OptionItem[];
  triggerModeOptions: readonly OptionItem[];
  cameraOptions: readonly OptionItem[];
  scheduleOptions: readonly OptionItem[];
};

type JobQueueFilterHandlersProps = {
  onStatusChange: (value: string) => void;
  onStrategyChange: (value: string) => void;
  onTriggerModeChange: (value: string) => void;
  onCameraChange: (value: string) => void;
  onScheduleChange: (value: string) => void;
};

type JobQueueFiltersProps = {
  values: JobQueueFilterValuesProps;
  options: JobQueueFilterOptionsProps;
  handlers: JobQueueFilterHandlersProps;
};

export function JobQueueFilters({ values, options, handlers }: JobQueueFiltersProps) {
  return (
    <FilterToolbar title="队列筛选" description="可按状态、策略、触发方式、摄像头及计划筛选">
      <Select
        size="small"
        value={values.statusFilter}
        onChange={handlers.onStatusChange}
        options={[...options.statusOptions]}
        className="page-toolbar-field"
      />
      <Select
        size="small"
        value={values.strategyFilter}
        onChange={handlers.onStrategyChange}
        options={[...options.strategyOptions]}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        size="small"
        value={values.triggerModeFilter}
        onChange={handlers.onTriggerModeChange}
        options={[...options.triggerModeOptions]}
        className="page-toolbar-field"
        data-testid="jobs-filter-trigger"
      />
      <Select
        size="small"
        value={values.cameraFilter}
        onChange={handlers.onCameraChange}
        options={[...options.cameraOptions]}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        size="small"
        value={values.scheduleFilter}
        onChange={handlers.onScheduleChange}
        options={[...options.scheduleOptions]}
        className="page-toolbar-field page-toolbar-field--md"
        data-testid="jobs-filter-schedule"
      />
    </FilterToolbar>
  );
}
