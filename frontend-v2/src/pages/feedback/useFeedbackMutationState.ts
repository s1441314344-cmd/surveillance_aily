import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  createFeedback,
  updateFeedback,
  type Feedback,
} from '@/shared/api/feedback';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import type { FeedbackFormValues } from '@/pages/feedback/types';

type UseFeedbackMutationStateParams = {
  effectiveRecordId: string | null;
  currentFeedback: Feedback | null;
};

export function useFeedbackMutationState({
  effectiveRecordId,
  currentFeedback,
}: UseFeedbackMutationStateParams) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const invalidateReviewData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-records'] }),
      queryClient.invalidateQueries({ queryKey: ['feedback-record', effectiveRecordId] }),
      queryClient.invalidateQueries({ queryKey: ['task-record-detail', effectiveRecordId] }),
    ]);

  const reviewMutation = useMutation({
    mutationFn: async (values: FeedbackFormValues) => {
      if (!effectiveRecordId) {
        throw new Error('missing-record');
      }

      if (currentFeedback) {
        return updateFeedback(currentFeedback.id, {
          judgement: values.judgement,
          correctedLabel: values.correctedLabel,
          comment: values.comment,
        });
      }

      return createFeedback({
        recordId: effectiveRecordId,
        judgement: values.judgement,
        correctedLabel: values.correctedLabel,
        comment: values.comment,
      });
    },
    onSuccess: async () => {
      await invalidateReviewData();
      message.success(currentFeedback ? '复核已更新' : '复核已提交');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '提交复核失败'));
    },
  });

  return {
    reviewMutation,
  };
}
