import { useState } from 'react';
import { type FormInstance } from 'antd';
import type { AlertWebhook } from '@/shared/api/configCenter';
import type { WebhookFormValues } from '@/pages/alerts/types';
import type { useAlertsMutationState } from '@/pages/alerts/useAlertsMutationState';

type UseAlertWebhookFormStateParams = {
  createForm: FormInstance<WebhookFormValues>;
  updateForm: FormInstance<WebhookFormValues>;
  mutations: ReturnType<typeof useAlertsMutationState>;
};

export function useAlertWebhookFormState({
  createForm,
  updateForm,
  mutations,
}: UseAlertWebhookFormStateParams) {
  const [editingWebhook, setEditingWebhook] = useState<AlertWebhook | null>(null);
  const { createWebhookMutation, updateWebhookMutation, normalizeWebhookPayload } = mutations;

  const openWebhookEditor = (webhook: AlertWebhook) => {
    setEditingWebhook(webhook);
    updateForm.setFieldsValue({
      name: webhook.name,
      endpoint: webhook.endpoint,
      events: (webhook.events ?? []).join(','),
      enabled: webhook.enabled,
      secret: '',
    });
  };

  const closeWebhookEditor = () => {
    setEditingWebhook(null);
  };

  const handleCreateWebhook = async (values: WebhookFormValues) => {
    await createWebhookMutation.mutateAsync(normalizeWebhookPayload(values));
    createForm.resetFields();
  };

  const handleUpdateWebhook = async (values: WebhookFormValues) => {
    if (!editingWebhook) {
      return;
    }
    await updateWebhookMutation.mutateAsync({
      webhookId: editingWebhook.id,
      payload: normalizeWebhookPayload(values),
    });
    setEditingWebhook(null);
  };

  return {
    editingWebhook,
    openWebhookEditor,
    closeWebhookEditor,
    handleCreateWebhook,
    handleUpdateWebhook,
  };
}
