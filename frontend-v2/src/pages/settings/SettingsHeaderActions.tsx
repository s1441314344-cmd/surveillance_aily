import { Button, Space } from 'antd';
import {
  ACTIVE_STATUS_LABELS,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import type { useSettingsPageController } from '@/pages/settings/useSettingsPageController';

type SettingsPageController = ReturnType<typeof useSettingsPageController>;

type SettingsHeaderActionsProps = {
  controller: SettingsPageController;
};

export function SettingsHeaderActions({ controller }: SettingsHeaderActionsProps) {
  const activeProvider = controller.queries.activeProvider;

  if (!activeProvider) {
    return null;
  }

  const isProviderBusy = controller.actions.saveLoading || controller.actions.debugLoading;

  return (
    <Space wrap>
      <StatusBadge
        namespace="generic"
        value={activeProvider.status}
        label={ACTIVE_STATUS_LABELS[activeProvider.status] ?? UNKNOWN_LABELS.generic}
      />
      <Button onClick={() => void controller.form.submit()} loading={controller.actions.saveLoading}>
        保存配置
      </Button>
      <Button
        type="primary"
        onClick={() => void controller.actions.handleSaveAndDebug()}
        loading={isProviderBusy}
      >
        保存并调试
      </Button>
    </Space>
  );
}
