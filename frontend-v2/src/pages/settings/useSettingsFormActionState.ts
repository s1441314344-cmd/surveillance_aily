import { useEffect } from 'react';
import { App, type FormInstance } from 'antd';
import type { ModelProvider } from '@/shared/api/configCenter';
import {
  DEFAULT_DEBUG_VALUES,
  type DebugFormValues,
  type ProviderFormValues,
} from '@/pages/settings/types';
import type { useSettingsMutationState } from '@/pages/settings/useSettingsMutationState';

const SELECT_PROVIDER_WARNING = '请先选择一个模型提供方';
const ARK_ENDPOINT_WARNING =
  '当前方舟模型看起来不是 endpoint id（ep-开头），附带图片调试可能失败，请优先使用 endpoint 模型或关闭示例图片。';

type UseSettingsFormActionStateParams = {
  form: FormInstance<ProviderFormValues>;
  debugForm: FormInstance<DebugFormValues>;
  activeProvider: ModelProvider | null;
  effectiveSelectedProvider: string | null;
  mutations: ReturnType<typeof useSettingsMutationState>;
};

function shouldWarnArkEndpoint(
  activeProvider: ModelProvider | null,
  includeSampleImage: boolean | undefined,
  model: string,
) {
  return (
    activeProvider?.provider === 'ark'
    && includeSampleImage
    && !model.trim().toLowerCase().startsWith('ep-')
  );
}

export function useSettingsFormActionState({
  form,
  debugForm,
  activeProvider,
  effectiveSelectedProvider,
  mutations,
}: UseSettingsFormActionStateParams) {
  const { message } = App.useApp();
  const { saveMutation, debugMutation } = mutations;
  const getSelectedProviderOrWarn = () => {
    if (!effectiveSelectedProvider) {
      message.warning(SELECT_PROVIDER_WARNING);
      return null;
    }
    return effectiveSelectedProvider;
  };

  useEffect(() => {
    if (!activeProvider) {
      return;
    }
    const isArkProvider = activeProvider.provider === 'ark';

    form.setFieldsValue({
      display_name: activeProvider.display_name,
      base_url: activeProvider.base_url,
      api_key: '',
      default_model: activeProvider.default_model,
      timeout_seconds: activeProvider.timeout_seconds,
      status: activeProvider.status,
    });
    debugForm.setFieldsValue({
      ...DEFAULT_DEBUG_VALUES,
      model: activeProvider.default_model,
      include_sample_image: isArkProvider ? false : DEFAULT_DEBUG_VALUES.include_sample_image,
    });
  }, [activeProvider, debugForm, form]);

  const handleSubmit = async (values: ProviderFormValues) => {
    const provider = getSelectedProviderOrWarn();
    if (!provider) {
      return;
    }
    await saveMutation.mutateAsync({ provider, payload: values });
  };

  const handleSaveAndDebug = async () => {
    const provider = getSelectedProviderOrWarn();
    if (!provider) {
      return;
    }

    const providerValues = await form.validateFields();
    await saveMutation.mutateAsync({ provider, payload: providerValues });
    const debugValues = await debugForm.validateFields();
    const debugModel = debugValues.model || providerValues.default_model || '';
    if (shouldWarnArkEndpoint(activeProvider, debugValues.include_sample_image, debugModel)) {
      message.warning(ARK_ENDPOINT_WARNING);
    }
    await debugMutation.mutateAsync({ provider, values: debugValues });
  };

  return {
    handleSubmit,
    handleSaveAndDebug,
    saveLoading: saveMutation.isPending,
    debugLoading: debugMutation.isPending,
  };
}
