import { useMemo } from 'react';
import { Button, Space } from 'antd';
import { buildAllOptions, FILTER_ALL_LABELS } from '@/shared/ui';
import { useRecordSelectionState } from '@/pages/records/useRecordSelectionState';
import { useRecordsActionState } from '@/pages/records/useRecordsActionState';
import { useRecordsFilterState } from '@/pages/records/useRecordsFilterState';
import { useRecordsQueryState } from '@/pages/records/useRecordsQueryState';
import type { RecordsFilterState } from '@/pages/records/types';

export function useRecordsPageController() {
  const filters = useRecordsFilterState();
  const { selectedRecordId, handleSelectRecord } = useRecordSelectionState();
  const recordFilters: RecordsFilterState = useMemo(
    () => ({
      statusFilter: filters.statusFilter,
      strategyFilter: filters.strategyFilter,
      jobTypeFilter: filters.jobTypeFilter,
      cameraFilter: filters.cameraFilter,
      modelProviderFilter: filters.modelProviderFilter,
      feedbackFilter: filters.feedbackFilter,
      createdFromFilter: filters.createdFromFilter,
      createdToFilter: filters.createdToFilter,
    }),
    [filters],
  );

  const queries = useRecordsQueryState({
    filters: recordFilters,
    selectedRecordId,
  });

  const { handleExport } = useRecordsActionState({
    filters: recordFilters,
  });

  const exportActions = useMemo(
    () => (
      <Space wrap>
        <Button onClick={filters.resetFilters}>重置筛选</Button>
        <Button type="default" onClick={() => void handleExport('csv')}>导出 CSV</Button>
        <Button type="primary" onClick={() => void handleExport('xlsx')}>导出 Excel</Button>
      </Space>
    ),
    [filters.resetFilters, handleExport],
  );

  const strategyOptions = useMemo(
    () =>
      buildAllOptions(queries.strategiesQuery.data, FILTER_ALL_LABELS.strategy, (item) => ({
        label: item.name,
        value: item.id,
      })),
    [queries.strategiesQuery.data],
  );
  const cameraOptions = useMemo(
    () =>
      buildAllOptions(queries.camerasQuery.data, FILTER_ALL_LABELS.camera, (item) => ({
        label: item.name,
        value: item.id,
      })),
    [queries.camerasQuery.data],
  );
  const providerOptions = useMemo(
    () =>
      buildAllOptions(queries.modelProviderQuery.data, FILTER_ALL_LABELS.provider, (item) => ({
        label: item.display_name || item.provider,
        value: item.provider,
      })),
    [queries.modelProviderQuery.data],
  );

  return {
    filters,
    queries,
    selectedRecordId,
    handleSelectRecord,
    exportActions,
    strategyOptions,
    cameraOptions,
    providerOptions,
  };
}
