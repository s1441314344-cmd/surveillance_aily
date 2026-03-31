import { Button, Select, Space } from 'antd';
import type { SelectOption } from '@/shared/ui/optionHelpers';

type StatusFilterActionsProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onReset: () => void;
  selectClassName?: string;
};

export function StatusFilterActions({
  value,
  options,
  onChange,
  onReset,
  selectClassName = 'page-toolbar-field',
}: StatusFilterActionsProps) {
  return (
    <Space wrap size={8}>
      <Select size="small" value={value} onChange={onChange} options={options} className={selectClassName} />
      <Button size="small" onClick={onReset}>
        重置筛选
      </Button>
    </Space>
  );
}
