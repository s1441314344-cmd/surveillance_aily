import { Select } from 'antd';
import { FilterToolbar, TRIGGER_MODE_FILTER_OPTIONS } from '@/shared/ui';

type JobQueueFiltersProps = {
  statusFilter: string;
  strategyFilter: string;
  triggerModeFilter: string;
  cameraFilter: string;
  scheduleFilter: string;
  statusOptions: readonly { label: string; value: string }[];
  strategyOptions: readonly { label: string; value: string }[];
  cameraOptions: readonly { label: string; value: string }[];
  scheduleOptions: readonly { label: string; value: string }[];
  onStatusChange: (value: string) => void;
  onStrategyChange: (value: string) => void;
  onTriggerModeChange: (value: string) => void;
  onCameraChange: (value: string) => void;
  onScheduleChange: (value: string) => void;
};

export function JobQueueFilters({
  statusFilter,
  strategyFilter,
  triggerModeFilter,
  cameraFilter,
  scheduleFilter,
  statusOptions,
  strategyOptions,
  cameraOptions,
  scheduleOptions,
  onStatusChange,
  onStrategyChange,
  onTriggerModeChange,
  onCameraChange,
  onScheduleChange,
}: JobQueueFiltersProps) {
  return (
    <FilterToolbar title="队列筛选" description="可按状态、策略、触发方式、摄像头及计划筛选">
      <Select
        size="small"
        value={statusFilter}
        onChange={onStatusChange}
        options={[...statusOptions]}
        className="page-toolbar-field"
      />
      <Select
        size="small"
        value={strategyFilter}
        onChange={onStrategyChange}
        options={[...strategyOptions]}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        size="small"
        value={triggerModeFilter}
        onChange={onTriggerModeChange}
        options={TRIGGER_MODE_FILTER_OPTIONS.map((item) => ({ label: item.label, value: item.value }))}
        className="page-toolbar-field"
        data-testid="jobs-filter-trigger"
      />
      <Select
        size="small"
        value={cameraFilter}
        onChange={onCameraChange}
        options={[...cameraOptions]}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        size="small"
        value={scheduleFilter}
        onChange={onScheduleChange}
        options={[...scheduleOptions]}
        className="page-toolbar-field page-toolbar-field--md"
        data-testid="jobs-filter-schedule"
      />
    </FilterToolbar>
  );
}
