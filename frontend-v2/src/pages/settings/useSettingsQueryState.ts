import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listModelProviders } from '@/shared/api/configCenter';
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

  const providerError = providerQuery.error
    ? getApiErrorMessage(providerQuery.error, '模型提供方加载失败')
    : null;

  return {
    providerQuery,
    providers,
    effectiveSelectedProvider,
    activeProvider,
    providerError,
  };
}
