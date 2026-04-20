import type { JobQueueTable } from '@/pages/jobs/JobQueueTable';
import type { ScheduleTable } from '@/pages/jobs/ScheduleTable';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';

export type JobsWorkspaceTabKey = 'queue' | 'schedule';

export type JobsWorkspaceSharedProps = {
  values: {
    workspaceTab: JobsWorkspaceTabKey;
  };
  handlers: {
    onWorkspaceTabChange: (value: JobsWorkspaceTabKey) => void;
  };
};

export type JobsWorkspaceQueueFiltersProps = {
  values: {
    statusFilter: string;
    strategyFilter: string;
    triggerModeFilter: string;
    cameraFilter: string;
    scheduleFilter: string;
  };
  options: {
    statusOptions: OptionItem[];
    strategyOptions: OptionItem[];
    triggerModeOptions: OptionItem[];
    cameraOptions: OptionItem[];
    scheduleOptions: OptionItem[];
  };
  handlers: {
    onStatusChange: (value: string) => void;
    onStrategyChange: (value: string) => void;
    onTriggerModeChange: (value: string) => void;
    onCameraChange: (value: string) => void;
    onScheduleChange: (value: string) => void;
  };
};

export type JobsWorkspaceQueueTimeRangeProps = {
  values: {
    createdFromFilter: string;
    createdToFilter: string;
  };
  handlers: {
    onCreatedFromChange: (value: string) => void;
    onCreatedToChange: (value: string) => void;
    onClearDateRange: () => void;
    onResetFilters: () => void;
  };
};

export type JobsWorkspaceQueueTableProps = Parameters<typeof JobQueueTable>[0];

export type JobsWorkspaceQueueProps = {
  filters: JobsWorkspaceQueueFiltersProps;
  timeRange: JobsWorkspaceQueueTimeRangeProps;
  table: JobsWorkspaceQueueTableProps;
};

export type JobsWorkspaceScheduleFiltersProps = {
  values: {
    scheduleStatusFilter: string;
    scheduleCameraFilter: string;
    scheduleStrategyFilter: string;
  };
  options: {
    statusOptions: OptionItem[];
    cameraOptions: OptionItem[];
    strategyOptions: OptionItem[];
  };
  handlers: {
    onScheduleStatusFilterChange: (value: string) => void;
    onScheduleCameraFilterChange: (value: string) => void;
    onScheduleStrategyFilterChange: (value: string) => void;
    onResetFilters: () => void;
  };
};

export type JobsWorkspaceScheduleTableProps = Parameters<typeof ScheduleTable>[0];

export type JobsWorkspaceScheduleProps = {
  filters: JobsWorkspaceScheduleFiltersProps;
  table: JobsWorkspaceScheduleTableProps;
};

export type JobsWorkspaceTabsProps = {
  shared: JobsWorkspaceSharedProps;
  queue: JobsWorkspaceQueueProps;
  schedule: JobsWorkspaceScheduleProps;
};
