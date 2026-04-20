import { useCallback, useState } from 'react';
import { Form } from 'antd';
import { type ModelProviderDebugResult } from '@/shared/api/modelProviders';
import { useSettingsFormActionState } from '@/pages/settings/useSettingsFormActionState';
import { useSettingsMutationState } from '@/pages/settings/useSettingsMutationState';
import { useSettingsQueryState } from '@/pages/settings/useSettingsQueryState';
import { useSettingsWorkspaceState } from '@/pages/settings/useSettingsWorkspaceState';
import { type DebugFormValues, type ProviderFormValues } from '@/pages/settings/types';

export function useSettingsPageController() {
  const [form] = Form.useForm<ProviderFormValues>();
  const [debugForm] = Form.useForm<DebugFormValues>();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [lastDebugResult, setLastDebugResult] = useState<ModelProviderDebugResult | null>(null);

  const queries = useSettingsQueryState({
    selectedProvider,
  });

  const mutations = useSettingsMutationState({
    onDebugResult: setLastDebugResult,
  });

  const actions = useSettingsFormActionState({
    form,
    debugForm,
    activeProvider: queries.activeProvider,
    effectiveSelectedProvider: queries.effectiveSelectedProvider,
    mutations: {
      saveMutation: mutations.saveMutation,
      debugMutation: mutations.debugMutation,
    },
  });

  const workspace = useSettingsWorkspaceState({
    providers: queries.providers,
    effectiveSelectedProvider: queries.effectiveSelectedProvider,
  });

  const handleSelectProvider = useCallback((provider: string) => {
    setSelectedProvider(provider);
    setLastDebugResult(null);
  }, []);

  return {
    form,
    debugForm,
    selectedProvider,
    lastDebugResult,
    setLastDebugResult,
    queries,
    actions,
    workspace,
    handleSelectProvider,
  };
}
