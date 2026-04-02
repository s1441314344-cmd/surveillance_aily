import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTrainingConfig,
  getTrainingOverview,
  listTrainingHistory,
  listModelCallLogs,
  listModelProviders,
  listStrategies,
  listTrainingDatasets,
  listTrainingRuns,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import { getEffectiveSelectionId } from '@/shared/utils/effectiveSelection';

type UseSettingsQueryStateParams = {
  selectedProvider: string | null;
};

export function useSettingsQueryState({ selectedProvider }: UseSettingsQueryStateParams) {
  const providerQuery = useQuery({
    queryKey: ['model-providers'],
    queryFn: listModelProviders,
  });

  const providers = useMemo(() => providerQuery.data ?? [], [providerQuery.data]);
  const effectiveSelectedProvider = useMemo(
    () =>
      getEffectiveSelectionId({
        items: providers,
        selectedId: selectedProvider,
        getId: (item) => item.provider,
      }),
    [providers, selectedProvider],
  );

  const activeProvider = useMemo(
    () => providers.find((item) => item.provider === effectiveSelectedProvider) ?? null,
    [effectiveSelectedProvider, providers],
  );

  const modelCallLogQuery = useQuery({
    queryKey: ['model-call-logs', effectiveSelectedProvider],
    queryFn: () =>
      listModelCallLogs({
        provider: effectiveSelectedProvider || undefined,
        limit: 100,
      }),
    enabled: Boolean(effectiveSelectedProvider),
    refetchInterval: 10000,
  });

  const trainingOverviewQuery = useQuery({
    queryKey: ['training-overview', 'all'],
    queryFn: () =>
      getTrainingOverview({
        provider: undefined,
      }),
    refetchInterval: 15000,
  });

  const trainingConfigQuery = useQuery({
    queryKey: ['training-config'],
    queryFn: getTrainingConfig,
    refetchInterval: 30000,
  });

  const trainingDatasetsQuery = useQuery({
    queryKey: ['training-datasets', 'all'],
    queryFn: () =>
      listTrainingDatasets({
        provider: undefined,
        limit: 20,
      }),
    refetchInterval: 15000,
  });

  const trainingRunsQuery = useQuery({
    queryKey: ['training-runs', 'all'],
    queryFn: () =>
      listTrainingRuns({
        provider: undefined,
        limit: 50,
      }),
    refetchInterval: 10000,
  });

  const trainingStrategiesQuery = useQuery({
    queryKey: ['training-strategies'],
    queryFn: () => listStrategies(),
    refetchInterval: 30000,
  });

  const trainingHistoryQuery = useQuery({
    queryKey: ['training-history', 'all'],
    queryFn: () =>
      listTrainingHistory({
        provider: undefined,
        limit: 100,
      }),
    refetchInterval: 15000,
  });

  const providerError = providerQuery.error
    ? getApiErrorMessage(providerQuery.error, '模型提供方加载失败')
    : null;
  const modelCallLogError = modelCallLogQuery.error
    ? getApiErrorMessage(modelCallLogQuery.error, '模型调用记录加载失败')
    : null;
  const trainingOverviewError = trainingOverviewQuery.error
    ? getApiErrorMessage(trainingOverviewQuery.error, '训练回流概览加载失败')
    : null;
  const trainingRunsError = trainingRunsQuery.error
    ? getApiErrorMessage(trainingRunsQuery.error, '训练回流运行列表加载失败')
    : null;
  const trainingDatasetsError = trainingDatasetsQuery.error
    ? getApiErrorMessage(trainingDatasetsQuery.error, '训练回流数据集加载失败')
    : null;
  const trainingConfigError = trainingConfigQuery.error
    ? getApiErrorMessage(trainingConfigQuery.error, '训练回流配置加载失败')
    : null;
  const trainingHistoryError = trainingHistoryQuery.error
    ? getApiErrorMessage(trainingHistoryQuery.error, '训练回流历史加载失败')
    : null;
  const trainingStrategiesError = trainingStrategiesQuery.error
    ? getApiErrorMessage(trainingStrategiesQuery.error, '训练策略列表加载失败')
    : null;
  const trainingError = trainingOverviewError || trainingConfigError || trainingRunsError || trainingDatasetsError || trainingHistoryError || trainingStrategiesError;

  return {
    providerQuery,
    providers,
    effectiveSelectedProvider,
    activeProvider,
    providerError,
    modelCallLogQuery,
    modelCallLogs: modelCallLogQuery.data ?? [],
    modelCallLogError,
    trainingOverviewQuery,
    trainingOverview: trainingOverviewQuery.data ?? null,
    trainingConfigQuery,
    trainingConfig: trainingConfigQuery.data ?? null,
    trainingDatasetsQuery,
    trainingDatasets: trainingDatasetsQuery.data ?? [],
    trainingRunsQuery,
    trainingRuns: trainingRunsQuery.data ?? [],
    trainingStrategiesQuery,
    trainingStrategies: trainingStrategiesQuery.data ?? [],
    trainingHistoryQuery,
    trainingHistory: trainingHistoryQuery.data ?? [],
    trainingError,
  };
}
