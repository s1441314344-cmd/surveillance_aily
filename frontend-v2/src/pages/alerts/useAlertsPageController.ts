import { useState } from 'react';
import { Form } from 'antd';
import { useAlertNotificationRouteFormState } from '@/pages/alerts/useAlertNotificationRouteFormState';
import { useAlertWebhookFormState } from '@/pages/alerts/useAlertWebhookFormState';
import { useAlertsFilterState } from '@/pages/alerts/useAlertsFilterState';
import { useAlertsMutationState } from '@/pages/alerts/useAlertsMutationState';
import { useAlertsQueryState } from '@/pages/alerts/useAlertsQueryState';
import { useAlertNotificationRouteColumns } from '@/pages/alerts/useAlertNotificationRouteColumns';
import { useAlertsTableColumns } from '@/pages/alerts/useAlertsTableColumns';
import {
  type NotificationRouteFormValues,
  type WebhookFormValues,
} from '@/pages/alerts/types';

function useWebhookForms() {
  const [createForm] = Form.useForm<WebhookFormValues>();
  const [updateForm] = Form.useForm<WebhookFormValues>();
  return { createForm, updateForm };
}

function useNotificationRouteForms() {
  const [createForm] = Form.useForm<NotificationRouteFormValues>();
  const [updateForm] = Form.useForm<NotificationRouteFormValues>();
  return { createForm, updateForm };
}

export function useAlertsPageController() {
  const { createForm, updateForm } = useWebhookForms();
  const { createForm: notificationCreateForm, updateForm: notificationUpdateForm } = useNotificationRouteForms();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [selectedNotificationRouteId, setSelectedNotificationRouteId] = useState<string | null>(null);
  const filters = useAlertsFilterState();

  const queries = useAlertsQueryState({
    statusFilter: filters.statusFilter,
    severityFilter: filters.severityFilter,
    keyword: filters.keyword,
  });

  const mutations = useAlertsMutationState();

  const formState = useAlertWebhookFormState({
    createForm,
    updateForm,
    mutations,
  });
  const notificationRouteFormState = useAlertNotificationRouteFormState({
    createForm: notificationCreateForm,
    updateForm: notificationUpdateForm,
    mutations,
  });

  const columns = useAlertsTableColumns({
    ackMutation: mutations.ackMutation,
    resolveMutation: mutations.resolveMutation,
    updateWebhookMutation: mutations.updateWebhookMutation,
    openWebhookEditor: formState.openWebhookEditor,
  });
  const notificationRouteColumns = useAlertNotificationRouteColumns({
    updateNotificationRouteMutation: mutations.updateNotificationRouteMutation,
    openNotificationRouteEditor: notificationRouteFormState.openNotificationRouteEditor,
  });

  return {
    createForm,
    updateForm,
    notificationCreateForm,
    notificationUpdateForm,
    selectedAlertId,
    setSelectedAlertId,
    selectedWebhookId,
    setSelectedWebhookId,
    selectedNotificationRouteId,
    setSelectedNotificationRouteId,
    filters,
    queries,
    mutations,
    formState,
    notificationRouteFormState,
    columns,
    notificationRouteColumns,
    handleResetEventFilters: filters.resetFilters,
  };
}
