import { Button, Input, Select } from 'antd';
import {
  ALERT_SEVERITY_OPTIONS,
  ALERT_STATUS_OPTIONS,
  FILTER_ALL_LABELS,
  FilterToolbar,
} from '@/shared/ui';
import type { ChangeEvent } from 'react';

const ALERT_STATUS_FILTER_OPTIONS = [
  { label: FILTER_ALL_LABELS.status, value: 'all' },
  ...ALERT_STATUS_OPTIONS,
];

const ALERT_SEVERITY_FILTER_OPTIONS = [
  { label: FILTER_ALL_LABELS.severity, value: 'all' },
  ...ALERT_SEVERITY_OPTIONS,
];

type AlertEventFiltersProps = {
  statusFilter: string;
  severityFilter: string;
  keyword: string;
  onStatusFilterChange: (value: string) => void;
  onSeverityFilterChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onReset: () => void;
};

function handleInputValueChange(
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
) {
  onChange(event.target.value);
}

export function AlertEventFilters({
  statusFilter,
  severityFilter,
  keyword,
  onStatusFilterChange,
  onSeverityFilterChange,
  onKeywordChange,
  onReset,
}: AlertEventFiltersProps) {
  const handleKeywordInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    handleInputValueChange(event, onKeywordChange);

  return (
    <FilterToolbar title="事件筛选" description="筛选条件由后端统一执行，保证分页与统计一致">
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        className="page-toolbar-field"
        options={ALERT_STATUS_FILTER_OPTIONS}
      />
      <Select
        value={severityFilter}
        onChange={onSeverityFilterChange}
        className="page-toolbar-field"
        options={ALERT_SEVERITY_FILTER_OPTIONS}
      />
      <Input.Search
        allowClear
        className="page-toolbar-field page-toolbar-field--lg"
        placeholder="按标题/内容搜索"
        value={keyword}
        onChange={handleKeywordInputChange}
        onSearch={onKeywordChange}
      />
      <Button onClick={onReset}>
        重置筛选
      </Button>
    </FilterToolbar>
  );
}
