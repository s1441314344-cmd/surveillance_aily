import { Button, DatePicker, Input, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { FilterToolbar, GENERIC_STATE_LABELS } from '@/shared/ui';

const { RangePicker } = DatePicker;

type AuditLogFiltersProps = {
  httpMethod?: string;
  success?: boolean;
  requestPath?: string;
  operatorUsername?: string;
  range: [Dayjs, Dayjs] | null;
  onHttpMethodChange: (value?: string) => void;
  onSuccessChange: (value?: boolean) => void;
  onRequestPathChange: (value: string) => void;
  onOperatorUsernameChange: (value: string) => void;
  onRangeChange: (value: [Dayjs, Dayjs] | null) => void;
  onReset: () => void;
};

export function AuditLogFilters({
  httpMethod,
  success,
  requestPath,
  operatorUsername,
  range,
  onHttpMethodChange,
  onSuccessChange,
  onRequestPathChange,
  onOperatorUsernameChange,
  onRangeChange,
  onReset,
}: AuditLogFiltersProps) {
  return (
    <FilterToolbar title="筛选条件" description="按方法、结果、路径、操作者和时间范围查询">
      <Select
        allowClear
        placeholder="请求方法"
        className="page-toolbar-field"
        value={httpMethod}
        options={[
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
        ]}
        onChange={onHttpMethodChange}
      />
      <Select
        allowClear
        placeholder="执行结果"
        className="page-toolbar-field"
        value={success}
        options={[
          { label: GENERIC_STATE_LABELS.success, value: true },
          { label: GENERIC_STATE_LABELS.failed, value: false },
        ]}
        onChange={onSuccessChange}
      />
      <Input
        allowClear
        placeholder="按路径筛选，如 /api/jobs"
        className="page-toolbar-field"
        value={requestPath ?? ''}
        onChange={(event) => onRequestPathChange(event.target.value)}
      />
      <Input
        allowClear
        placeholder="操作人用户名"
        className="page-toolbar-field"
        value={operatorUsername ?? ''}
        onChange={(event) => onOperatorUsernameChange(event.target.value)}
      />
      <RangePicker
        showTime
        className="page-toolbar-field page-toolbar-field--lg"
        value={range}
        onChange={(value) => onRangeChange(value as [Dayjs, Dayjs] | null)}
      />
      <Button onClick={onReset}>重置筛选</Button>
    </FilterToolbar>
  );
}
