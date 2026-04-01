import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTrainingOverview,
  listModelCallLogs,
  listModelProviders,
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
    queryKey: ['training-overview', effectiveSelectedProvider],
    queryFn: () =>
      getTrainingOverview({
        provider: effectiveSelectedProvider || undefined,
      }),
    refetchInterval: 15000,
  });

  const trainingDatasetsQuery = useQuery({
    queryKey: ['training-datasets', effectiveSelectedProvider],
    queryFn: () =>
      listTrainingDatasets({
        provider: effectiveSelectedProvider || undefined,
        limit: 20,
      }),
    refetchInterval: 15000,
  });

  const trainingRunsQuery = useQuery({
    queryKey: ['training-runs', effectiveSelectedProvider],
    queryFn: () =>
      listTrainingRuns({
        provider: effectiveSelectedProvider || undefined,
        limit: 50,
      }),
    refetchInterval: 10000,
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
  const trainingError = trainingOverviewError || trainingRunsError || trainingDatasetsError;

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
    trainingDatasetsQuery,
    trainingDatasets: trainingDatasetsQuery.data ?? [],
    trainingRunsQuery,
    trainingRuns: trainingRunsQuery.data ?? [],
    trainingError,
  };
}
