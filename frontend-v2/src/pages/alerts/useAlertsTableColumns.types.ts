import type { AlertWebhook } from '@/shared/api/alerts';
import type { useAlertsMutationState } from '@/pages/alerts/useAlertsMutationState';

export type UseAlertsTableColumnsParams = {
  ackMutation: ReturnType<typeof useAlertsMutationState>['ackMutation'];
  resolveMutation: ReturnType<typeof useAlertsMutationState>['resolveMutation'];
  updateWebhookMutation: ReturnType<typeof useAlertsMutationState>['updateWebhookMutation'];
  openWebhookEditor: (webhook: AlertWebhook) => void;
};
