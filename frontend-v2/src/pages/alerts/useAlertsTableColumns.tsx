import type { UseAlertsTableColumnsParams } from '@/pages/alerts/useAlertsTableColumns.types';
import { useAlertRecordColumns } from '@/pages/alerts/useAlertRecordColumns';
import { useAlertWebhookColumns } from '@/pages/alerts/useAlertWebhookColumns';

export function useAlertsTableColumns({
  ackMutation,
  resolveMutation,
  updateWebhookMutation,
  openWebhookEditor,
}: UseAlertsTableColumnsParams) {
  const alertColumns = useAlertRecordColumns({ ackMutation, resolveMutation });
  const webhookColumns = useAlertWebhookColumns({ updateWebhookMutation, openWebhookEditor });

  return {
    alertColumns,
    webhookColumns,
  };
}
