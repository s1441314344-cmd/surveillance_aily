import { Button } from 'antd';
import type { useDashboardsPageController } from '@/pages/dashboards/useDashboardsPageController';

type DashboardsPageController = ReturnType<typeof useDashboardsPageController>;

type DashboardsHeaderActionsProps = {
  controller: DashboardsPageController;
};

export function DashboardsHeaderActions({ controller }: DashboardsHeaderActionsProps) {
  return (
    <Button type="primary" onClick={controller.actions.resetForCreate}>
      新建看板
    </Button>
  );
}
