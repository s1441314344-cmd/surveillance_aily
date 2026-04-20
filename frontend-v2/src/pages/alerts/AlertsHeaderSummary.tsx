import { AlertSummaryBadges } from '@/pages/alerts/AlertSummaryBadges';
import type { useAlertsPageController } from '@/pages/alerts/useAlertsPageController';

type AlertsPageController = ReturnType<typeof useAlertsPageController>;

type AlertsHeaderSummaryProps = {
  controller: AlertsPageController;
};

export function AlertsHeaderSummary({ controller }: AlertsHeaderSummaryProps) {
  return (
    <AlertSummaryBadges
      total={controller.queries.alertSummary.total}
      open={controller.queries.alertSummary.open}
      acknowledged={controller.queries.alertSummary.acknowledged}
      resolved={controller.queries.alertSummary.resolved}
    />
  );
}
