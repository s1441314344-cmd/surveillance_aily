import { Button, Input } from 'antd';
import { FilterToolbar, SectionCard } from '@/shared/ui';
import { JobQueueFilters } from '@/pages/jobs/JobQueueFilters';
import { JobQueueTable } from '@/pages/jobs/JobQueueTable';
import type { ChangeEvent } from 'react';

type JobQueueTimeRangeValuesProps = {
  createdFromFilter: string;
  createdToFilter: string;
};

type JobQueueTimeRangeHandlersProps = {
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onClearDateRange: () => void;
  onResetFilters: () => void;
};

type JobQueueTimeRangeProps = {
  values: JobQueueTimeRangeValuesProps;
  handlers: JobQueueTimeRangeHandlersProps;
};

type JobQueueSectionProps = {
  filters: Parameters<typeof JobQueueFilters>[0];
  timeRange: JobQueueTimeRangeProps;
  table: Parameters<typeof JobQueueTable>[0];
};

const TIME_RANGE_FIELD_CLASS = 'page-toolbar-field page-toolbar-field--lg';

function handleDateTimeInputChange(
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
) {
  onChange(event.target.value);
}

export function JobQueueSection({ filters, timeRange, table }: JobQueueSectionProps) {
  const handleCreatedFromInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleDateTimeInputChange(event, timeRange.handlers.onCreatedFromChange);
  const handleCreatedToInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleDateTimeInputChange(event, timeRange.handlers.onCreatedToChange);

  return (
    <SectionCard title="任务队列" subtitle="支持多维筛选、取消任务和失败重试">
      <JobQueueFilters {...filters} />

      <FilterToolbar dense title="时间范围" description="用于筛选队列中的创建时间区间">
        <Input
          size="small"
          type="datetime-local"
          value={timeRange.values.createdFromFilter}
          onChange={handleCreatedFromInputChange}
          className={TIME_RANGE_FIELD_CLASS}
        />
        <Input
          size="small"
          type="datetime-local"
          value={timeRange.values.createdToFilter}
          onChange={handleCreatedToInputChange}
          className={TIME_RANGE_FIELD_CLASS}
        />
        <Button size="small" onClick={timeRange.handlers.onClearDateRange}>
          清空时间
        </Button>
        <Button size="small" onClick={timeRange.handlers.onResetFilters}>
          重置筛选
        </Button>
      </FilterToolbar>

      <JobQueueTable {...table} />
    </SectionCard>
  );
}
