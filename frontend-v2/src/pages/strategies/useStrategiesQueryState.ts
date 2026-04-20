import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { listModelProviders } from '@/shared/api/modelProviders';
import { listStrategies } from '@/shared/api/strategies';
import { CREATE_STRATEGY_ID } from '@/pages/strategies/types';

type UseStrategiesQueryStateParams = {
  statusFilter: string;
  selectedStrategyId: string | null;
};

export function useStrategiesQueryState({
  statusFilter,
  selectedStrategyId,
}: UseStrategiesQueryStateParams) {
  const providerQuery = useQuery({
    queryKey: ['model-providers'],
    queryFn: listModelProviders,
  });

  const preferredProvider = useMemo(() => {
    const providers = providerQuery.data ?? [];
    return (
      providers.find((item) => item.provider === 'zhipu') ??
      providers.find((item) => item.status === 'active') ??
      providers[0] ??
      null
    );
  }, [providerQuery.data]);

  const strategyQuery = useQuery({
    queryKey: ['strategies', statusFilter],
    queryFn: () =>
      listStrategies({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const strategies = useMemo(() => strategyQuery.data ?? [], [strategyQuery.data]);
  const effectiveSelectedStrategyId = useMemo(() => {
    if (selectedStrategyId === CREATE_STRATEGY_ID) {
      return null;
    }

    const exists = selectedStrategyId && strategies.some((item) => item.id === selectedStrategyId);
    return exists ? selectedStrategyId : strategies[0]?.id ?? null;
  }, [selectedStrategyId, strategies]);

  const activeStrategy = useMemo(
    () => strategies.find((item) => item.id === effectiveSelectedStrategyId) ?? null,
    [effectiveSelectedStrategyId, strategies],
  );

  const strategyError = strategyQuery.error
    ? getApiErrorMessage(strategyQuery.error, '策略列表加载失败')
    : null;

  return {
    providerQuery,
    preferredProvider,
    strategyQuery,
    strategies,
    effectiveSelectedStrategyId,
    activeStrategy,
    strategyError,
  };
}
