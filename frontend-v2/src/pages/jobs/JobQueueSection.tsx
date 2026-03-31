import { Button, Input } from 'antd';
import type { Camera } from '@/shared/api/configCenter';
import type { Job } from '@/shared/api/tasks';
import { FilterToolbar, SectionCard } from '@/shared/ui';
import { JobQueueFilters } from '@/pages/jobs/JobQueueFilters';
import { JobQueueTable } from '@/pages/jobs/JobQueueTable';
import type { ChangeEvent } from 'react';

type OptionItem = {
  label: string;
  value: string;
};

type JobQueueSectionProps = {
  jobs: Job[];
  cameras: Camera[];
  selectedJobId?: string | null;
  loading: boolean;
  cancelLoading: boolean;
  retryLoading: boolean;
  statusFilter: string;
  strategyFilter: string;
  triggerModeFilter: string;
  cameraFilter: string;
  scheduleFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
  statusOptions: OptionItem[];
  strategyOptions: OptionItem[];
  cameraOptions: OptionItem[];
  scheduleOptions: OptionItem[];
  onStatusChange: (value: string) => void;
  onStrategyChange: (value: string) => void;
  onTriggerModeChange: (value: string) => void;
  onCameraChange: (value: string) => void;
  onScheduleChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onClearDateRange: () => void;
  onResetFilters: () => void;
  onSelectJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
};

const TIME_RANGE_FIELD_CLASS = 'page-toolbar-field page-toolbar-field--lg';

function handleDateTimeInputChange(
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
) {
  onChange(event.target.value);
}

export function JobQueueSection({
  jobs,
  cameras,
  selectedJobId,
  loading,
  cancelLoading,
  retryLoading,
  statusFilter,
  strategyFilter,
  triggerModeFilter,
  cameraFilter,
  scheduleFilter,
  createdFromFilter,
  createdToFilter,
  statusOptions,
  strategyOptions,
  cameraOptions,
  scheduleOptions,
  onStatusChange,
  onStrategyChange,
  onTriggerModeChange,
  onCameraChange,
  onScheduleChange,
  onCreatedFromChange,
  onCreatedToChange,
  onClearDateRange,
  onResetFilters,
  onSelectJob,
  onCancelJob,
  onRetryJob,
}: JobQueueSectionProps) {
  const handleCreatedFromInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleDateTimeInputChange(event, onCreatedFromChange);
  const handleCreatedToInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleDateTimeInputChange(event, onCreatedToChange);

  return (
    <SectionCard title="任务队列" subtitle="支持多维筛选、取消任务和失败重试">
      <JobQueueFilters
        statusFilter={statusFilter}
        strategyFilter={strategyFilter}
        triggerModeFilter={triggerModeFilter}
        cameraFilter={cameraFilter}
        scheduleFilter={scheduleFilter}
        statusOptions={statusOptions}
        strategyOptions={strategyOptions}
        cameraOptions={cameraOptions}
        scheduleOptions={scheduleOptions}
        onStatusChange={onStatusChange}
        onStrategyChange={onStrategyChange}
        onTriggerModeChange={onTriggerModeChange}
        onCameraChange={onCameraChange}
        onScheduleChange={onScheduleChange}
      />

      <FilterToolbar dense title="时间范围" description="用于筛选队列中的创建时间区间">
        <Input
          size="small"
          type="datetime-local"
          value={createdFromFilter}
          onChange={handleCreatedFromInputChange}
          className={TIME_RANGE_FIELD_CLASS}
        />
        <Input
          size="small"
          type="datetime-local"
          value={createdToFilter}
          onChange={handleCreatedToInputChange}
          className={TIME_RANGE_FIELD_CLASS}
        />
        <Button size="small" onClick={onClearDateRange}>
          清空时间
        </Button>
        <Button size="small" onClick={onResetFilters}>
          重置筛选
        </Button>
      </FilterToolbar>

      <JobQueueTable
        jobs={jobs}
        cameras={cameras}
        selectedJobId={selectedJobId}
        loading={loading}
        cancelLoading={cancelLoading}
        retryLoading={retryLoading}
        onSelectJob={onSelectJob}
        onCancelJob={onCancelJob}
        onRetryJob={onRetryJob}
      />
    </SectionCard>
  );
}
