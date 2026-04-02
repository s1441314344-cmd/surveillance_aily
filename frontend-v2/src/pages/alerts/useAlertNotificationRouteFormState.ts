import { useState } from 'react';
import type { FormInstance } from 'antd/es/form';
import type { AlertNotificationRoute } from '@/shared/api/configCenter';
import type { NotificationRouteFormValues } from '@/pages/alerts/types';
import type { useAlertsMutationState } from '@/pages/alerts/useAlertsMutationState';

type UseAlertNotificationRouteFormStateParams = {
  createForm: FormInstance<NotificationRouteFormValues>;
  updateForm: FormInstance<NotificationRouteFormValues>;
  mutations: ReturnType<typeof useAlertsMutationState>;
};

export function useAlertNotificationRouteFormState({
  createForm,
  updateForm,
  mutations,
}: UseAlertNotificationRouteFormStateParams) {
  const [editingRoute, setEditingRoute] = useState<AlertNotificationRoute | null>(null);
  const {
    createNotificationRouteMutation,
    updateNotificationRouteMutation,
    normalizeNotificationRoutePayload,
  } = mutations;

  const openNotificationRouteEditor = (route: AlertNotificationRoute) => {
    setEditingRoute(route);
    updateForm.setFieldsValue({
      name: route.name,
      strategy_id: route.strategy_id || undefined,
      event_key: route.event_key || undefined,
      severity: route.severity || undefined,
      camera_id: route.camera_id || undefined,
      recipient_type: route.recipient_type,
      recipient_id: route.recipient_id,
      enabled: route.enabled,
      priority: route.priority,
      cooldown_seconds: route.cooldown_seconds,
      message_template: route.message_template || undefined,
    });
  };

  const closeNotificationRouteEditor = () => {
    setEditingRoute(null);
  };

  const handleCreateNotificationRoute = async (values: NotificationRouteFormValues) => {
    await createNotificationRouteMutation.mutateAsync(normalizeNotificationRoutePayload(values));
    createForm.resetFields();
    createForm.setFieldsValue({
      enabled: true,
      recipient_type: 'chat',
      priority: 100,
      cooldown_seconds: 0,
    });
  };

  const handleUpdateNotificationRoute = async (values: NotificationRouteFormValues) => {
    if (!editingRoute) {
      return;
    }
    await updateNotificationRouteMutation.mutateAsync({
      routeId: editingRoute.id,
      payload: normalizeNotificationRoutePayload(values),
    });
    setEditingRoute(null);
  };

  return {
    editingRoute,
    openNotificationRouteEditor,
    closeNotificationRouteEditor,
    handleCreateNotificationRoute,
    handleUpdateNotificationRoute,
  };
}
