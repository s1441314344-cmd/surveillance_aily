import { useState } from 'react';
import { Form } from 'antd';
import { useAlertWebhookFormState } from '@/pages/alerts/useAlertWebhookFormState';
import { useAlertsFilterState } from '@/pages/alerts/useAlertsFilterState';
import { useAlertsMutationState } from '@/pages/alerts/useAlertsMutationState';
import { useAlertsQueryState } from '@/pages/alerts/useAlertsQueryState';
import { useAlertsTableColumns } from '@/pages/alerts/useAlertsTableColumns';
import { type WebhookFormValues } from '@/pages/alerts/types';

function buildWebhookFormMutations(mutations: ReturnType<typeof useAlertsMutationState>) {
  return {
    ackMutation: mutations.ackMutation,
    resolveMutation: mutations.resolveMutation,
    createWebhookMutation: mutations.createWebhookMutation,
    updateWebhookMutation: mutations.updateWebhookMutation,
    normalizeWebhookPayload: mutations.normalizeWebhookPayload,
  };
}

function useWebhookForms() {
  const [createForm] = Form.useForm<WebhookFormValues>();
  const [updateForm] = Form.useForm<WebhookFormValues>();
  return { createForm, updateForm };
}

export function useAlertsPageController() {
  const { createForm, updateForm } = useWebhookForms();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const filters = useAlertsFilterState();

  const queries = useAlertsQueryState({
    statusFilter: filters.statusFilter,
    severityFilter: filters.severityFilter,
    keyword: filters.keyword,
  });

  const mutations = useAlertsMutationState();

  const webhookFormMutations = buildWebhookFormMutations(mutations);
  const formState = useAlertWebhookFormState({
    createForm,
    updateForm,
    mutations: webhookFormMutations,
  });

  const columns = useAlertsTableColumns({
    ackMutation: mutations.ackMutation,
    resolveMutation: mutations.resolveMutation,
    updateWebhookMutation: mutations.updateWebhookMutation,
    openWebhookEditor: formState.openWebhookEditor,
  });

  return {
    createForm,
    updateForm,
    selectedAlertId,
    setSelectedAlertId,
    selectedWebhookId,
    setSelectedWebhookId,
    filters,
    queries,
    mutations,
    formState,
    columns,
    handleResetEventFilters: filters.resetFilters,
  };
}
