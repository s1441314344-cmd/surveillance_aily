import { useCallback, useEffect } from 'react';
import { App, type FormInstance } from 'antd';
import type { ModelProvider } from '@/shared/api/modelProviders';
import type { Strategy } from '@/shared/api/strategies';
import {
  CREATE_STRATEGY_ID,
  DEFAULT_STRATEGY_FORM_VALUES,
  type StrategyFormValues,
} from '@/pages/strategies/types';
import type { useStrategiesMutationState } from '@/pages/strategies/useStrategiesMutationState';
import {
  parseStrategyResponseSchema,
  parseStrategyValidationSchema,
} from '@/pages/strategies/strategySchemaUtils';

type UseStrategiesFormActionStateParams = {
  form: FormInstance<StrategyFormValues>;
  preferredProvider: ModelProvider | null;
  activeStrategy: Strategy | null;
  effectiveSelectedStrategyId: string | null;
  setSelectedStrategyId: (strategyId: string | null) => void;
  mutations: ReturnType<typeof useStrategiesMutationState>;
};

function getStrategyResultFormat(resultFormat?: StrategyFormValues['result_format']) {
  return resultFormat || 'json_schema';
}

export function useStrategiesFormActionState({
  form,
  preferredProvider,
  activeStrategy,
  effectiveSelectedStrategyId,
  setSelectedStrategyId,
  mutations,
}: UseStrategiesFormActionStateParams) {
  const { message } = App.useApp();
  const { createMutation, updateMutation, validateMutation } = mutations;

  useEffect(() => {
    if (!activeStrategy) {
      return;
    }

    form.setFieldsValue({
      name: activeStrategy.name,
      scene_description: activeStrategy.scene_description,
      prompt_template: activeStrategy.prompt_template,
      model_provider: activeStrategy.model_provider,
      model_name: activeStrategy.model_name,
      result_format: activeStrategy.result_format || 'json_schema',
      response_schema_text: JSON.stringify(activeStrategy.response_schema, null, 2),
      status: activeStrategy.status,
    });
  }, [activeStrategy, form]);

  const resetForCreate = useCallback(() => {
    setSelectedStrategyId(CREATE_STRATEGY_ID);
    form.setFieldsValue({
      ...DEFAULT_STRATEGY_FORM_VALUES,
      model_provider: preferredProvider?.provider ?? 'zhipu',
      model_name: preferredProvider?.default_model ?? 'glm-4v-plus',
    });
  }, [form, preferredProvider, setSelectedStrategyId]);

  useEffect(() => {
    if (!activeStrategy && preferredProvider) {
      resetForCreate();
    }
  }, [preferredProvider, activeStrategy, resetForCreate]);

  const handleSubmit = async (values: StrategyFormValues) => {
    const resultFormat = getStrategyResultFormat(values.result_format);
    const { responseSchema, errorMessage } = parseStrategyResponseSchema(
      values.response_schema_text ?? '',
      resultFormat,
    );
    if (errorMessage || !responseSchema) {
      message.error(errorMessage ?? 'Schema 配置校验失败');
      return;
    }

    const payload = {
      name: values.name,
      scene_description: values.scene_description,
      prompt_template: values.prompt_template,
      model_provider: values.model_provider,
      model_name: values.model_name,
      result_format: resultFormat,
      response_schema: responseSchema,
      status: values.status,
    };

    if (effectiveSelectedStrategyId) {
      await updateMutation.mutateAsync({ strategyId: effectiveSelectedStrategyId, payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const handleValidate = async () => {
    if (!effectiveSelectedStrategyId) {
      message.info('请先保存策略，再执行服务端 Schema 校验');
      return;
    }

    if (getStrategyResultFormat(form.getFieldValue('result_format')) !== 'json_schema') {
      message.info('当前输出模式不是 JSON Schema，无需执行 Schema 校验');
      return;
    }

    const raw = form.getFieldValue('response_schema_text') ?? DEFAULT_STRATEGY_FORM_VALUES.response_schema_text;
    const { schema, errorMessage } = parseStrategyValidationSchema(raw);
    if (errorMessage || !schema) {
      message.error(errorMessage ?? 'JSON Schema 校验失败');
      return;
    }
    await validateMutation.mutateAsync({ strategyId: effectiveSelectedStrategyId, schema });
  };

  return {
    resetForCreate,
    handleSubmit,
    handleValidate,
    submitLoading: createMutation.isPending || updateMutation.isPending,
    validateLoading: validateMutation.isPending,
  };
}
