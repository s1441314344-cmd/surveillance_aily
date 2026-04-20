import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listCameras } from '@/shared/api/cameras';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { listModelProviders } from '@/shared/api/modelProviders';
import { listStrategies } from '@/shared/api/strategies';
import { useObjectUrl } from '@/shared/hooks/useObjectUrl';
import {
  fetchTaskRecordImage,
  getTaskRecord,
  listTaskRecords,
} from '@/shared/api/records';
import type { RecordsFilterState } from '@/pages/records/types';
import { buildTaskRecordFilterParams } from '@/pages/records/recordsTaskRecordParams';

type UseRecordsQueryStateParams = {
  filters: RecordsFilterState;
  selectedRecordId: string | null;
};

function buildRecordsQueryKey(filters: RecordsFilterState) {
  return [
    'task-records',
    filters.statusFilter,
    filters.strategyFilter,
    filters.jobTypeFilter,
    '',
    filters.cameraFilter,
    filters.modelProviderFilter,
    filters.feedbackFilter,
    filters.createdFromFilter,
    filters.createdToFilter,
  ] as const;
}

export function useRecordsQueryState({ filters, selectedRecordId }: UseRecordsQueryStateParams) {
  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'records'],
    queryFn: () => listStrategies(),
  });

  const camerasQuery = useQuery({
    queryKey: ['cameras', 'records'],
    queryFn: () => listCameras(),
  });

  const modelProviderQuery = useQuery({
    queryKey: ['model-providers', 'records'],
    queryFn: () => listModelProviders(),
  });
  const recordsQueryKey = useMemo(() => buildRecordsQueryKey(filters), [filters]);
  const recordsQueryParams = useMemo(() => buildTaskRecordFilterParams(filters), [filters]);

  const recordsQuery = useQuery({
    queryKey: recordsQueryKey,
    queryFn: () => listTaskRecords(recordsQueryParams),
  });

  const recordDetailQuery = useQuery({
    queryKey: ['task-record-detail', selectedRecordId],
    queryFn: () => getTaskRecord(selectedRecordId as string),
    enabled: Boolean(selectedRecordId),
  });

  const imageQuery = useQuery({
    queryKey: ['task-record-image', selectedRecordId],
    queryFn: () => fetchTaskRecordImage(selectedRecordId as string),
    enabled: Boolean(selectedRecordId),
  });

  const imagePreviewUrl = useObjectUrl(imageQuery.data);

  const records = recordsQuery.data ?? [];
  const detail = recordDetailQuery.data;
  const hasDetail = Boolean(detail);
  const recordsError = recordsQuery.error
    ? getApiErrorMessage(recordsQuery.error, '记录列表加载失败')
    : null;

  return {
    strategiesQuery,
    camerasQuery,
    modelProviderQuery,
    recordsQuery,
    recordDetailQuery,
    imageQuery,
    imagePreviewUrl,
    records,
    detail,
    hasDetail,
    recordsError,
  };
}
