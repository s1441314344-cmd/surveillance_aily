import { useEffect } from 'react';
import type { FormInstance } from 'antd';
import type { FeedbackFormValues } from '@/pages/feedback/types';
import type { useFeedbackMutationState } from '@/pages/feedback/useFeedbackMutationState';

type UseFeedbackFormActionStateParams = {
  form: FormInstance<FeedbackFormValues>;
  effectiveRecordId: string | null;
  initialFormValues: Partial<FeedbackFormValues> | null;
  mutations: ReturnType<typeof useFeedbackMutationState>;
};

export function useFeedbackFormActionState({
  form,
  effectiveRecordId,
  initialFormValues,
  mutations,
}: UseFeedbackFormActionStateParams) {
  const { reviewMutation } = mutations;

  useEffect(() => {
    if (!effectiveRecordId) {
      form.resetFields();
      return;
    }

    if (initialFormValues) {
      form.setFieldsValue(initialFormValues);
      return;
    }

    form.resetFields();
  }, [effectiveRecordId, form, initialFormValues]);

  const handleSubmit = (values: FeedbackFormValues) => reviewMutation.mutateAsync(values);

  return {
    handleSubmit,
    submitLoading: reviewMutation.isPending,
  };
}
