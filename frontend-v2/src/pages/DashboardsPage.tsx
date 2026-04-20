import { RoutePageHeader } from '@/shared/ui';
import { DashboardsHeaderActions } from '@/pages/dashboards/DashboardsHeaderActions';
import { DashboardsWorkspace } from '@/pages/dashboards/DashboardsWorkspace';
import { useDashboardsPageController } from '@/pages/dashboards/useDashboardsPageController';

export function DashboardsPage() {
  const controller = useDashboardsPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader
        description="管理可复用看板定义（布局 JSON + 指标组合），后续拖拽式看板会在此基础上扩展。"
        extra={<DashboardsHeaderActions controller={controller} />}
      />

      <DashboardsWorkspace controller={controller} />
    </div>
  );
}
