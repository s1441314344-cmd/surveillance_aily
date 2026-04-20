import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  createDashboardDefinition,
  deleteDashboardDefinition,
  updateDashboardDefinition,
  validateDashboardDefinition,
  validateDashboardDefinitionDraft,
} from '@/shared/api/dashboard';
import {
  createDashboardApiErrorHandler,
  invalidateDashboardQueries,
} from '@/pages/dashboards/dashboardsMutationHelpers';

type UseDashboardsMutationStateParams = {
  statusFilter: string;
  onDashboardCreated: (dashboardId: string) => void;
};

export function useDashboardsMutationState({
  statusFilter,
  onDashboardCreated,
}: UseDashboardsMutationStateParams) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const handleDashboardMutationSuccess = async (successMessage: string) => {
    await invalidateDashboardQueries(queryClient, statusFilter);
    message.success(successMessage);
  };
  const showValidationErrors = (errors: string[]) => {
    modal.error({
      title: '服务端校验失败',
      content: (
        <ul className="page-bullet-list">
          {errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    });
  };

  const createMutation = useMutation({
    mutationFn: createDashboardDefinition,
    onSuccess: async (dashboard) => {
      onDashboardCreated(dashboard.id);
      await handleDashboardMutationSuccess('看板定义创建成功');
    },
    onError: createDashboardApiErrorHandler(message, '看板定义创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      dashboardId,
      payload,
    }: {
      dashboardId: string;
      payload: Parameters<typeof updateDashboardDefinition>[1];
    }) => updateDashboardDefinition(dashboardId, payload),
    onSuccess: async () => handleDashboardMutationSuccess('看板定义已更新'),
    onError: createDashboardApiErrorHandler(message, '看板定义更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDashboardDefinition,
    onSuccess: async () => handleDashboardMutationSuccess('看板定义已删除'),
    onError: createDashboardApiErrorHandler(message, '看板定义删除失败'),
  });

  const validateMutation = useMutation({
    mutationFn: ({ dashboardId, definition }: { dashboardId?: string; definition: Record<string, unknown> }) =>
      dashboardId ? validateDashboardDefinition(dashboardId, definition) : validateDashboardDefinitionDraft(definition),
    onSuccess: (result) => {
      if (result.valid) {
        message.success('看板定义服务端校验通过');
        return;
      }
      showValidationErrors(result.errors);
    },
    onError: createDashboardApiErrorHandler(message, '看板定义服务端校验失败'),
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    validateMutation,
  };
}
