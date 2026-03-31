import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  ackAlert,
  createAlertWebhook,
  resolveAlert,
  updateAlertWebhook,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import type { WebhookFormValues } from '@/pages/alerts/types';

export function useAlertsMutationState() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const handleMutationError = (error: unknown, fallbackMessage: string) => {
    message.error(getApiErrorMessage(error, fallbackMessage));
  };
  const handleAlertMutationSuccess = async (successMessage: string) => {
    await queryClient.invalidateQueries({ queryKey: ['alerts'] });
    message.success(successMessage);
  };
  const handleWebhookMutationSuccess = async (
    successMessage: string,
    invalidateAlerts = false,
  ) => {
    await queryClient.invalidateQueries({ queryKey: ['alert-webhooks'] });
    if (invalidateAlerts) {
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
    message.success(successMessage);
  };

  const ackMutation = useMutation({
    mutationFn: ackAlert,
    onSuccess: async () => handleAlertMutationSuccess('告警已确认'),
    onError: (error) => handleMutationError(error, '确认告警失败'),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: async () => handleAlertMutationSuccess('告警已处理'),
    onError: (error) => handleMutationError(error, '处理告警失败'),
  });

  const createWebhookMutation = useMutation({
    mutationFn: createAlertWebhook,
    onSuccess: async () => handleWebhookMutationSuccess('Webhook 已新增'),
    onError: (error) => handleMutationError(error, 'Webhook 新增失败'),
  });

  const updateWebhookMutation = useMutation({
    mutationFn: ({
      webhookId,
      payload,
    }: {
      webhookId: string;
      payload: Parameters<typeof updateAlertWebhook>[1];
    }) => updateAlertWebhook(webhookId, payload),
    onSuccess: async () => handleWebhookMutationSuccess('Webhook 已更新', true),
    onError: (error) => handleMutationError(error, 'Webhook 更新失败'),
  });

  const normalizeWebhookPayload = (values: WebhookFormValues) => ({
    name: values.name.trim(),
    endpoint: values.endpoint.trim(),
    enabled: values.enabled,
    events: values.events
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    secret: values.secret?.trim() || undefined,
  });

  return {
    ackMutation,
    resolveMutation,
    createWebhookMutation,
    updateWebhookMutation,
    normalizeWebhookPayload,
  };
}
