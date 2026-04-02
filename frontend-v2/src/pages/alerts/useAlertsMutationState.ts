import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  ackAlert,
  createAlertNotificationRoute,
  createAlertWebhook,
  resolveAlert,
  updateAlertNotificationRoute,
  updateAlertWebhook,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import type {
  NotificationRouteFormValues,
  WebhookFormValues,
} from '@/pages/alerts/types';

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
  const handleNotificationRouteMutationSuccess = async (successMessage: string) => {
    await queryClient.invalidateQueries({ queryKey: ['alert-notification-routes'] });
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

  const createNotificationRouteMutation = useMutation({
    mutationFn: createAlertNotificationRoute,
    onSuccess: async () => handleNotificationRouteMutationSuccess('通知路由已新增'),
    onError: (error) => handleMutationError(error, '通知路由新增失败'),
  });

  const updateNotificationRouteMutation = useMutation({
    mutationFn: ({
      routeId,
      payload,
    }: {
      routeId: string;
      payload: Parameters<typeof updateAlertNotificationRoute>[1];
    }) => updateAlertNotificationRoute(routeId, payload),
    onSuccess: async () => handleNotificationRouteMutationSuccess('通知路由已更新'),
    onError: (error) => handleMutationError(error, '通知路由更新失败'),
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

  const normalizeNotificationRoutePayload = (values: NotificationRouteFormValues) => ({
    name: values.name.trim(),
    strategy_id: values.strategy_id?.trim() || null,
    event_key: values.event_key?.trim().toLowerCase() || null,
    severity: values.severity?.trim().toLowerCase() || null,
    camera_id: values.camera_id?.trim() || null,
    recipient_type: values.recipient_type,
    recipient_id: values.recipient_id.trim(),
    enabled: values.enabled,
    priority: Number(values.priority || 0),
    cooldown_seconds: Number(values.cooldown_seconds || 0),
    message_template: values.message_template?.trim() || null,
  });

  return {
    ackMutation,
    resolveMutation,
    createWebhookMutation,
    updateWebhookMutation,
    createNotificationRouteMutation,
    updateNotificationRouteMutation,
    normalizeWebhookPayload,
    normalizeNotificationRoutePayload,
  };
}
