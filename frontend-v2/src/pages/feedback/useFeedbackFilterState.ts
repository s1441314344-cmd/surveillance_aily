import { useCallback, useState } from 'react';

const FEEDBACK_FILTER_DEFAULTS = {
  feedbackStatusFilter: 'unreviewed',
  resultStatusFilter: 'all',
  strategyFilter: 'all',
} as const;

export function useFeedbackFilterState() {
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>(
    FEEDBACK_FILTER_DEFAULTS.feedbackStatusFilter,
  );
  const [resultStatusFilter, setResultStatusFilter] = useState<string>(
    FEEDBACK_FILTER_DEFAULTS.resultStatusFilter,
  );
  const [strategyFilter, setStrategyFilter] = useState<string>(
    FEEDBACK_FILTER_DEFAULTS.strategyFilter,
  );

  const resetFilters = useCallback(() => {
    setFeedbackStatusFilter(FEEDBACK_FILTER_DEFAULTS.feedbackStatusFilter);
    setResultStatusFilter(FEEDBACK_FILTER_DEFAULTS.resultStatusFilter);
    setStrategyFilter(FEEDBACK_FILTER_DEFAULTS.strategyFilter);
  }, []);

  return {
    feedbackStatusFilter,
    setFeedbackStatusFilter,
    resultStatusFilter,
    setResultStatusFilter,
    strategyFilter,
    setStrategyFilter,
    resetFilters,
  };
}
