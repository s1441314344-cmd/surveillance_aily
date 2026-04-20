import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  debugModelProvider,
  type ModelProviderDebugResult,
  updateModelProvider,
} from '@/shared/api/modelProviders';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { parseDebugSchema, type DebugFormValues, type ProviderFormValues } from '@/pages/settings/types';

type UseSettingsMutationStateParams = {
  onDebugResult: (result: ModelProviderDebugResult | null) => void;
};

export function useSettingsMutationState({ onDebugResult }: UseSettingsMutationStateParams) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: ({ provider, payload }: { provider: string; payload: ProviderFormValues }) =>
      updateModelProvider(provider, {
        display_name: payload.display_name,
        base_url: payload.base_url,
        api_key: payload.api_key?.trim() || undefined,
        default_model: payload.default_model,
        timeout_seconds: Number(payload.timeout_seconds),
        status: payload.status,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['model-providers'] });
      message.success(`${variables.provider.toUpperCase()} 配置已保存`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '模型提供方保存失败'));
    },
  });

  const debugMutation = useMutation({
    mutationFn: ({ provider, values }: { provider: string; values: DebugFormValues }) =>
      debugModelProvider(provider, {
        model: values.model?.trim() || undefined,
        prompt: values.prompt,
        response_format: values.response_format,
        response_schema:
          values.response_format === 'json_schema' ? parseDebugSchema(values.response_schema || '') : undefined,
        include_sample_image: values.include_sample_image,
      }),
    onSuccess: (result) => {
      onDebugResult(result);
      if (result.success) {
        message.success(`${result.display_name} 调试成功`);
      } else {
        message.warning(result.error_message || '调试失败，请检查日志');
      }
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '提供方调试失败'));
    },
  });

  return {
    saveMutation,
    debugMutation,
  };
}
