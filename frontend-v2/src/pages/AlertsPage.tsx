import { RoutePageHeader } from '@/shared/ui';
import { AlertsEditModals } from '@/pages/alerts/AlertsEditModals';
import { AlertsHeaderSummary } from '@/pages/alerts/AlertsHeaderSummary';
import { AlertsTabsWorkspace } from '@/pages/alerts/AlertsTabsWorkspace';
import { useAlertsPageController } from '@/pages/alerts/useAlertsPageController';

export function AlertsPage() {
  const controller = useAlertsPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader
        description="统一查看监测告警、处理状态，并维护 Webhook 推送配置。"
        extra={<AlertsHeaderSummary controller={controller} />}
      />

      <AlertsTabsWorkspace controller={controller} />
      <AlertsEditModals controller={controller} />
    </div>
  );
}
