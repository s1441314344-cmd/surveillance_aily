import { Input, Select } from 'antd';
import { type ReactNode } from 'react';
import type { ChangeEvent } from 'react';
import {
  FEEDBACK_STATUS_OPTIONS,
  FILTER_ALL_LABELS,
  FilterToolbar,
  JOB_TYPE_LABELS,
  RESULT_STATUS_OPTIONS,
} from '@/shared/ui';

type OptionItem = {
  label: string;
  value: string;
};

const RECORD_JOB_TYPE_OPTIONS = [
  { label: FILTER_ALL_LABELS.taskType, value: 'all' },
  ...Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ label, value })),
];

const RECORD_FEEDBACK_OPTIONS = [
  { label: FILTER_ALL_LABELS.feedback, value: 'all' },
  ...FEEDBACK_STATUS_OPTIONS,
];

const RECORD_STATUS_OPTIONS = [
  { label: FILTER_ALL_LABELS.status, value: 'all' },
  ...RESULT_STATUS_OPTIONS,
];

function handleDateInputChange(
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
) {
  onChange(event.target.value);
}

type RecordsFiltersProps = {
  actions?: ReactNode;
  statusFilter: string;
  strategyFilter: string;
  jobTypeFilter: string;
  cameraFilter: string;
  modelProviderFilter: string;
  feedbackFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
  strategyOptions: OptionItem[];
  cameraOptions: OptionItem[];
  providerOptions: OptionItem[];
  onStatusChange: (value: string) => void;
  onStrategyChange: (value: string) => void;
  onJobTypeChange: (value: string) => void;
  onCameraChange: (value: string) => void;
  onModelProviderChange: (value: string) => void;
  onFeedbackChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
};

export function RecordsFilters({
  actions,
  statusFilter,
  strategyFilter,
  jobTypeFilter,
  cameraFilter,
  modelProviderFilter,
  feedbackFilter,
  createdFromFilter,
  createdToFilter,
  strategyOptions,
  cameraOptions,
  providerOptions,
  onStatusChange,
  onStrategyChange,
  onJobTypeChange,
  onCameraChange,
  onModelProviderChange,
  onFeedbackChange,
  onCreatedFromChange,
  onCreatedToChange,
}: RecordsFiltersProps) {
  return (
    <FilterToolbar
      title="筛选条件"
      description="按状态、策略、摄像头、模型与时间定位记录"
      actions={actions}
    >
      <Select
        value={statusFilter}
        onChange={onStatusChange}
        options={RECORD_STATUS_OPTIONS}
        className="page-toolbar-field"
      />
      <Select
        value={strategyFilter}
        onChange={onStrategyChange}
        options={strategyOptions}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        value={jobTypeFilter}
        onChange={onJobTypeChange}
        options={RECORD_JOB_TYPE_OPTIONS}
        className="page-toolbar-field"
      />
      <Select
        value={cameraFilter}
        onChange={onCameraChange}
        options={cameraOptions}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        value={modelProviderFilter}
        onChange={onModelProviderChange}
        options={providerOptions}
        className="page-toolbar-field page-toolbar-field--md"
      />
      <Select
        value={feedbackFilter}
        onChange={onFeedbackChange}
        options={RECORD_FEEDBACK_OPTIONS}
        className="page-toolbar-field"
      />
      <Input
        type="date"
        value={createdFromFilter}
        onChange={(event) => handleDateInputChange(event, onCreatedFromChange)}
        className="page-toolbar-field"
      />
      <Input
        type="date"
        value={createdToFilter}
        onChange={(event) => handleDateInputChange(event, onCreatedToChange)}
        className="page-toolbar-field"
      />
    </FilterToolbar>
  );
}
