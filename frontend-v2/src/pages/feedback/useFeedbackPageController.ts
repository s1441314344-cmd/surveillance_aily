import { useMemo } from 'react';
import { Form } from 'antd';
import { buildAllOptions, FILTER_ALL_LABELS } from '@/shared/ui';
import { useFeedbackFilterState } from '@/pages/feedback/useFeedbackFilterState';
import { useFeedbackFormActionState } from '@/pages/feedback/useFeedbackFormActionState';
import { useFeedbackMutationState } from '@/pages/feedback/useFeedbackMutationState';
import { useFeedbackQueryState } from '@/pages/feedback/useFeedbackQueryState';
import { useFeedbackSelectionState } from '@/pages/feedback/useFeedbackSelectionState';
import { type FeedbackFormValues } from '@/pages/feedback/types';

function buildFeedbackStrategyOptions(
  strategies: ReturnType<typeof useFeedbackQueryState>['strategiesQuery']['data'],
) {
  return buildAllOptions(
    strategies,
    FILTER_ALL_LABELS.strategy,
    (item) => ({ label: item.name, value: item.id }),
  );
}

export function useFeedbackPageController() {
  const [form] = Form.useForm<FeedbackFormValues>();
  const filters = useFeedbackFilterState();
  const selection = useFeedbackSelectionState();

  const queries = useFeedbackQueryState({
    feedbackStatusFilter: filters.feedbackStatusFilter,
    resultStatusFilter: filters.resultStatusFilter,
    strategyFilter: filters.strategyFilter,
    selectedRecordId: selection.selectedRecordId,
  });

  const mutations = useFeedbackMutationState({
    effectiveRecordId: queries.effectiveRecordId,
    currentFeedback: queries.currentFeedback,
  });

  const actions = useFeedbackFormActionState({
    form,
    effectiveRecordId: queries.effectiveRecordId,
    initialFormValues: queries.initialFormValues,
    mutations: {
      reviewMutation: mutations.reviewMutation,
    },
  });

  const strategyOptions = useMemo(
    () => buildFeedbackStrategyOptions(queries.strategiesQuery.data),
    [queries.strategiesQuery.data],
  );

  return {
    form,
    filters,
    selection,
    queries,
    actions,
    strategyOptions,
    handleResetFilters: filters.resetFilters,
  };
}
