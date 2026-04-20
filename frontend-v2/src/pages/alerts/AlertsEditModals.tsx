import { useMemo } from 'react';
import { AlertNotificationRouteEditModal } from '@/pages/alerts/AlertNotificationRouteEditModal';
import { AlertWebhookEditModal } from '@/pages/alerts/AlertWebhookEditModal';
import type { useAlertsPageController } from '@/pages/alerts/useAlertsPageController';

type AlertsPageController = ReturnType<typeof useAlertsPageController>;

type AlertsEditModalsProps = {
  controller: AlertsPageController;
};

export function AlertsEditModals({ controller }: AlertsEditModalsProps) {
  const strategyOptions = useMemo(
    () =>
      controller.queries.strategies.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [controller.queries.strategies],
  );

  return (
    <>
      <AlertWebhookEditModal
        form={controller.updateForm}
        open={Boolean(controller.formState.editingWebhook)}
        confirmLoading={controller.mutations.updateWebhookMutation.isPending}
        onCancel={controller.formState.closeWebhookEditor}
        onSubmit={controller.formState.handleUpdateWebhook}
      />

      <AlertNotificationRouteEditModal
        form={controller.notificationUpdateForm}
        open={Boolean(controller.notificationRouteFormState.editingRoute)}
        confirmLoading={controller.mutations.updateNotificationRouteMutation.isPending}
        strategyOptions={strategyOptions}
        onCancel={controller.notificationRouteFormState.closeNotificationRouteEditor}
        onSubmit={controller.notificationRouteFormState.handleUpdateNotificationRoute}
      />
    </>
  );
}
