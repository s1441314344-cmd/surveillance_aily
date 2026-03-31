import { useCallback, useEffect } from 'react';
import { App, type FormInstance } from 'antd';
import type { DashboardDefinition } from '@/shared/api/configCenter';
import {
  CREATE_DASHBOARD_ID,
  DEFAULT_DASHBOARD_FORM_VALUES,
  type DashboardFormValues,
} from '@/pages/dashboards/types';
import type { useDashboardsMutationState } from '@/pages/dashboards/useDashboardsMutationState';
import { parseDashboardDefinitionText } from '@/pages/dashboards/dashboardDefinitionValidation';

type UseDashboardsFormActionStateParams = {
  form: FormInstance<DashboardFormValues>;
  dashboardsCount: number;
  activeDashboard: DashboardDefinition | null;
  effectiveSelectedDashboardId: string | null;
  setSelectedDashboardId: (dashboardId: string | null) => void;
  mutations: ReturnType<typeof useDashboardsMutationState>;
};

function buildDashboardPayload(values: DashboardFormValues, definition: DashboardDefinition['definition']) {
  return {
    name: values.name,
    description: values.description?.trim() || null,
    definition,
    status: values.status,
    is_default: values.is_default,
  };
}

export function useDashboardsFormActionState({
  form,
  dashboardsCount,
  activeDashboard,
  effectiveSelectedDashboardId,
  setSelectedDashboardId,
  mutations,
}: UseDashboardsFormActionStateParams) {
  const { message, modal } = App.useApp();
  const { createMutation, updateMutation, deleteMutation, validateMutation } = mutations;
  const parseDefinitionText = useCallback(
    (definitionText: string) => parseDashboardDefinitionText(definitionText, message, modal),
    [message, modal],
  );

  useEffect(() => {
    if (!activeDashboard) {
      return;
    }

    form.setFieldsValue({
      name: activeDashboard.name,
      description: activeDashboard.description ?? '',
      definition_text: JSON.stringify(activeDashboard.definition ?? {}, null, 2),
      status: activeDashboard.status,
      is_default: activeDashboard.is_default,
    });
  }, [activeDashboard, form]);

  const resetForCreate = useCallback(() => {
    setSelectedDashboardId(CREATE_DASHBOARD_ID);
    form.setFieldsValue(DEFAULT_DASHBOARD_FORM_VALUES);
  }, [form, setSelectedDashboardId]);

  useEffect(() => {
    if (!activeDashboard && dashboardsCount === 0) {
      resetForCreate();
    }
  }, [activeDashboard, dashboardsCount, resetForCreate]);

  const handleSubmit = async (values: DashboardFormValues) => {
    const definition = parseDefinitionText(values.definition_text);
    if (!definition) {
      return;
    }

    const payload = buildDashboardPayload(values, definition);

    if (effectiveSelectedDashboardId) {
      await updateMutation.mutateAsync({
        dashboardId: effectiveSelectedDashboardId,
        payload,
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const handleValidateDefinition = async () => {
    const definition = parseDefinitionText(
      form.getFieldValue('definition_text') ?? DEFAULT_DASHBOARD_FORM_VALUES.definition_text,
    );
    if (!definition) {
      return;
    }

    await validateMutation.mutateAsync({
      dashboardId: effectiveSelectedDashboardId ?? undefined,
      definition,
    });
  };

  const handleDelete = () => {
    if (!effectiveSelectedDashboardId) {
      return;
    }

    modal.confirm({
      title: '删除看板定义',
      content: '删除后不可恢复，是否继续？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteMutation.mutateAsync(effectiveSelectedDashboardId);
        setSelectedDashboardId(null);
        resetForCreate();
      },
    });
  };

  return {
    resetForCreate,
    handleSubmit,
    handleValidateDefinition,
    handleDelete,
    submitLoading: createMutation.isPending || updateMutation.isPending,
    validateLoading: validateMutation.isPending,
    deleteLoading: deleteMutation.isPending,
  };
}
