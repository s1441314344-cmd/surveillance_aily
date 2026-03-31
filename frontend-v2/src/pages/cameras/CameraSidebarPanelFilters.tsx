import { Button, Input, Space, Switch, Typography } from 'antd';
import { FilterToolbar } from '@/shared/ui';

const { Text } = Typography;

type CameraSidebarPanelFiltersProps = {
  cameraSearch: string;
  alertOnly: boolean;
  onCameraSearchChange: (value: string) => void;
  onAlertOnlyChange: (value: boolean) => void;
  onResetFilters: () => void;
};

export function CameraSidebarPanelFilters({
  cameraSearch,
  alertOnly,
  onCameraSearchChange,
  onAlertOnlyChange,
  onResetFilters,
}: CameraSidebarPanelFiltersProps) {
  return (
    <FilterToolbar
      title="筛选"
      dense
      actions={(
        <Button size="small" onClick={onResetFilters}>
          重置筛选
        </Button>
      )}
    >
      <Input.Search
        className="page-toolbar-field"
        placeholder="搜索名称、位置或地址"
        allowClear
        value={cameraSearch}
        onChange={(event) => onCameraSearchChange(event.target.value)}
      />
      <Space size={6}>
        <Text type="secondary">仅看告警</Text>
        <Switch size="small" checked={alertOnly} onChange={onAlertOnlyChange} data-testid="cameras-alert-only-switch" />
      </Space>
    </FilterToolbar>
  );
}
