import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { JobDetailViewModel } from '@/pages/jobs/jobDetailMapper';
import { fetchTaskRecordImage, listTaskRecords, type TaskRecord } from '@/shared/api/records';

type UseJobDetailDrawerStateParams = {
  open: boolean;
  job?: JobDetailViewModel | null;
};

export function useJobDetailDrawerState({ open, job }: UseJobDetailDrawerStateParams) {
  const recordsQuery = useQuery({
    queryKey: ['jobs', 'detail', job?.id, 'task-records'],
    queryFn: async () => listTaskRecords({ jobId: job?.id }),
    enabled: Boolean(open && job?.id),
  });

  const latestRecord = useMemo<TaskRecord | null>(() => {
    const records = recordsQuery.data;
    if (!records || records.length === 0) {
      return null;
    }
    return [...records].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })[0] ?? null;
  }, [recordsQuery.data]);

  const recordImageQuery = useQuery({
    queryKey: ['jobs', 'detail', job?.id, 'task-record-image', latestRecord?.id],
    queryFn: async () => {
      if (!latestRecord?.id) {
        return null;
      }
      return fetchTaskRecordImage(latestRecord.id);
    },
    enabled: Boolean(open && latestRecord?.id),
  });

  const recordImageUrl = useMemo(() => {
    if (!recordImageQuery.data) {
      return null;
    }
    return URL.createObjectURL(recordImageQuery.data);
  }, [recordImageQuery.data]);

  useEffect(() => {
    return () => {
      if (recordImageUrl) {
        URL.revokeObjectURL(recordImageUrl);
      }
    };
  }, [recordImageUrl]);

  return {
    recordsQuery,
    latestRecord,
    recordImageQuery,
    recordImageUrl,
    resultStatusValue: job?.result_status ?? latestRecord?.result_status,
    feedbackStatusValue: job?.feedback_status ?? latestRecord?.feedback_status,
    normalizedJsonValue: job?.normalized_json ?? latestRecord?.normalized_json ?? null,
    rawResponseValue: job?.raw_model_response ?? latestRecord?.raw_model_response ?? '',
  };
}
