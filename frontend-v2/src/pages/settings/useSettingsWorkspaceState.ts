import { useCallback, useMemo, useState } from 'react';
import type { ModelProvider } from '@/shared/api/modelProviders';
import { getEffectiveSelectionId } from '@/shared/utils/effectiveSelection';

type UseSettingsWorkspaceStateParams = {
  providers: ModelProvider[];
  effectiveSelectedProvider: string | null;
};

export function useSettingsWorkspaceState({
  providers,
  effectiveSelectedProvider,
}: UseSettingsWorkspaceStateParams) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredProviders = useMemo(
    () => providers.filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter)),
    [providers, statusFilter],
  );

  const effectiveSelectedProviderInFilter = useMemo(
    () =>
      getEffectiveSelectionId({
        items: filteredProviders,
        selectedId: effectiveSelectedProvider,
        getId: (item) => item.provider,
      }),
    [effectiveSelectedProvider, filteredProviders],
  );

  const handleResetListFilter = useCallback(() => {
    setStatusFilter('all');
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    filteredProviders,
    effectiveSelectedProviderInFilter,
    handleResetListFilter,
  };
}
