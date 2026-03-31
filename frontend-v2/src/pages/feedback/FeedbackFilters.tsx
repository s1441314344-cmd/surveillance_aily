import { Button, Select } from 'antd';
import {
  FEEDBACK_STATUS_OPTIONS,
  FILTER_ALL_LABELS,
  FilterToolbar,
  RESULT_STATUS_OPTIONS,
} from '@/shared/ui';

type OptionItem = {
  label: string;
  value: string;
};

const FEEDBACK_FILTER_OPTIONS = [
  FEEDBACK_STATUS_OPTIONS[0],
  { label: FILTER_ALL_LABELS.feedback, value: 'all' },
  ...FEEDBACK_STATUS_OPTIONS.slice(1),
];

const RESULT_FILTER_OPTIONS = [
  { label: FILTER_ALL_LABELS.result, value: 'all' },
  ...RESULT_STATUS_OPTIONS,
];

type FeedbackFiltersProps = {
  feedbackStatusFilter: string;
  resultStatusFilter: string;
  strategyFilter: string;
  strategyOptions: OptionItem[];
  onFeedbackStatusChange: (value: string) => void;
  onResultStatusChange: (value: string) => void;
  onStrategyChange: (value: string) => void;
  onReset: () => void;
};

function renderResetButton(onReset: () => void) {
  return <Button onClick={onReset}>重置筛选</Button>;
}

export function FeedbackFilters({
  feedbackStatusFilter,
  resultStatusFilter,
  strategyFilter,
  strategyOptions,
  onFeedbackStatusChange,
  onResultStatusChange,
  onStrategyChange,
  onReset,
}: FeedbackFiltersProps) {
  return (
    <FilterToolbar
      title="筛选条件"
      description="按反馈状态、结果状态、策略定位记录"
      actions={renderResetButton(onReset)}
    >
      <Select
        value={feedbackStatusFilter}
        onChange={onFeedbackStatusChange}
        className="page-toolbar-field"
        options={FEEDBACK_FILTER_OPTIONS}
      />
      <Select
        value={resultStatusFilter}
        onChange={onResultStatusChange}
        className="page-toolbar-field"
        options={RESULT_FILTER_OPTIONS}
      />
      <Select
        value={strategyFilter}
        onChange={onStrategyChange}
        options={strategyOptions}
        className="page-toolbar-field page-toolbar-field--md"
      />
    </FilterToolbar>
  );
}
