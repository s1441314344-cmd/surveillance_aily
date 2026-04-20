import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  createStrategy,
  updateStrategy,
  updateStrategyStatus,
  validateStrategySchema,
} from '@/shared/api/strategies';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';

type UseStrategiesMutationStateParams = {
  statusFilter: string;
  onStrategyCreated: (strategyId: string) => void;
};

export function useStrategiesMutationState({
  statusFilter,
  onStrategyCreated,
}: UseStrategiesMutationStateParams) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const invalidateStrategyQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['strategies'] }),
      queryClient.invalidateQueries({ queryKey: ['strategies', statusFilter] }),
    ]);

  const createMutation = useMutation({
    mutationFn: createStrategy,
    onSuccess: async (strategy) => {
      await invalidateStrategyQueries();
      onStrategyCreated(strategy.id);
      message.success('策略创建成功');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '策略创建失败'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ strategyId, payload }: { strategyId: string; payload: Parameters<typeof updateStrategy>[1] }) =>
      updateStrategy(strategyId, payload),
    onSuccess: async () => {
      await invalidateStrategyQueries();
      message.success('策略已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '策略更新失败'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ strategyId, status }: { strategyId: string; status: string }) =>
      updateStrategyStatus(strategyId, status),
    onSuccess: async () => {
      await invalidateStrategyQueries();
      message.success('策略状态已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '策略状态更新失败'));
    },
  });

  const validateMutation = useMutation({
    mutationFn: ({ strategyId, schema }: { strategyId: string; schema: Record<string, unknown> }) =>
      validateStrategySchema(strategyId, schema),
    onSuccess: (result) => {
      if (result.valid) {
        message.success('Schema 校验通过');
      } else {
        modal.error({
          title: 'Schema 校验失败',
          content: (
            <ul className="page-bullet-list">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ),
        });
      }
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Schema 校验失败'));
    },
  });

  return {
    createMutation,
    updateMutation,
    updateStatusMutation,
    validateMutation,
  };
}
