import { useState } from 'react';
import { Form } from 'antd';
import { useStrategiesFormActionState } from '@/pages/strategies/useStrategiesFormActionState';
import { useStrategiesMutationState } from '@/pages/strategies/useStrategiesMutationState';
import { useStrategiesQueryState } from '@/pages/strategies/useStrategiesQueryState';
import { type StrategyFormValues } from '@/pages/strategies/types';

export function useStrategiesPageController() {
  const [form] = Form.useForm<StrategyFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const queries = useStrategiesQueryState({
    statusFilter,
    selectedStrategyId,
  });

  const mutations = useStrategiesMutationState({
    statusFilter,
    onStrategyCreated: setSelectedStrategyId,
  });

  const actions = useStrategiesFormActionState({
    form,
    preferredProvider: queries.preferredProvider,
    activeStrategy: queries.activeStrategy,
    effectiveSelectedStrategyId: queries.effectiveSelectedStrategyId,
    setSelectedStrategyId,
    mutations: {
      createMutation: mutations.createMutation,
      updateMutation: mutations.updateMutation,
      updateStatusMutation: mutations.updateStatusMutation,
      validateMutation: mutations.validateMutation,
    },
  });

  const handleResetListFilter = () => {
    setStatusFilter('all');
  };

  const providerOptions = (queries.providerQuery.data ?? []).map((item) => ({
    label: `${item.display_name} (${item.provider})`,
    value: item.provider,
  }));

  const handleToggleStrategyStatus = () => {
    if (!queries.activeStrategy) {
      return;
    }
    mutations.updateStatusMutation.mutate({
      strategyId: queries.activeStrategy.id,
      status: queries.activeStrategy.status === 'active' ? 'inactive' : 'active',
    });
  };

  return {
    form,
    statusFilter,
    setStatusFilter,
    selectedStrategyId,
    setSelectedStrategyId,
    queries,
    mutations,
    actions,
    providerOptions,
    handleResetListFilter,
    handleToggleStrategyStatus,
  };
}
