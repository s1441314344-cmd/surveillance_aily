import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listFeedback } from '@/shared/api/feedback';
import { listStrategies } from '@/shared/api/strategies';
import { useObjectUrl } from '@/shared/hooks/useObjectUrl';
import {
  fetchTaskRecordImage,
  getTaskRecord,
  listTaskRecords,
} from '@/shared/api/records';
import type { FeedbackFormValues } from '@/pages/feedback/types';

type UseFeedbackQueryStateParams = {
  feedbackStatusFilter: string;
  resultStatusFilter: string;
  strategyFilter: string;
  selectedRecordId: string | null;
};

function buildFeedbackTaskRecordParams({
  feedbackStatusFilter,
  resultStatusFilter,
  strategyFilter,
}: Omit<UseFeedbackQueryStateParams, 'selectedRecordId'>) {
  return {
    feedbackStatus: feedbackStatusFilter === 'all' ? undefined : feedbackStatusFilter,
    status: resultStatusFilter === 'all' ? undefined : resultStatusFilter,
    strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
  };
}

function getInitialFeedbackFormValues(
  currentFeedback: {
    judgement: string;
    corrected_label?: string | null;
    comment?: string | null;
  } | null,
): Partial<FeedbackFormValues> | null {
  if (!currentFeedback) {
    return null;
  }

  return {
    judgement: currentFeedback.judgement as FeedbackFormValues['judgement'],
    correctedLabel: currentFeedback.corrected_label ?? undefined,
    comment: currentFeedback.comment ?? undefined,
  };
}

export function useFeedbackQueryState({
  feedbackStatusFilter,
  resultStatusFilter,
  strategyFilter,
  selectedRecordId,
}: UseFeedbackQueryStateParams) {
  const taskRecordParams = useMemo(
    () =>
      buildFeedbackTaskRecordParams({
        feedbackStatusFilter,
        resultStatusFilter,
        strategyFilter,
      }),
    [feedbackStatusFilter, resultStatusFilter, strategyFilter],
  );

  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'feedback'],
    queryFn: () => listStrategies(),
  });

  const recordsQuery = useQuery({
    queryKey: ['task-records', 'feedback', feedbackStatusFilter, resultStatusFilter, strategyFilter],
    queryFn: () => listTaskRecords(taskRecordParams),
  });

  const records = recordsQuery.data ?? [];
  const effectiveRecordId = selectedRecordId || records[0]?.id || null;

  const recordDetailQuery = useQuery({
    queryKey: ['task-record-detail', effectiveRecordId],
    queryFn: () => getTaskRecord(effectiveRecordId as string),
    enabled: Boolean(effectiveRecordId),
  });

  const feedbackQuery = useQuery({
    queryKey: ['feedback-record', effectiveRecordId],
    queryFn: () => listFeedback({ recordId: effectiveRecordId as string }),
    enabled: Boolean(effectiveRecordId),
  });

  const imageQuery = useQuery({
    queryKey: ['task-record-image', effectiveRecordId],
    queryFn: () => fetchTaskRecordImage(effectiveRecordId as string),
    enabled: Boolean(effectiveRecordId),
  });

  const detail = recordDetailQuery.data ?? null;
  const currentFeedback = useMemo(() => feedbackQuery.data?.[0] ?? null, [feedbackQuery.data]);
  const imagePreviewUrl = useObjectUrl(imageQuery.data);

  const initialFormValues: Partial<FeedbackFormValues> | null = getInitialFeedbackFormValues(currentFeedback);

  return {
    strategiesQuery,
    recordsQuery,
    recordDetailQuery,
    feedbackQuery,
    imageQuery,
    records,
    effectiveRecordId,
    detail,
    currentFeedback,
    imagePreviewUrl,
    initialFormValues,
  };
}
