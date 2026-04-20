import { FeedbackFilters } from '@/pages/feedback/FeedbackFilters';
import type { useFeedbackPageController } from '@/pages/feedback/useFeedbackPageController';

type FeedbackPageController = ReturnType<typeof useFeedbackPageController>;

type FeedbackFiltersSectionProps = {
  controller: FeedbackPageController;
};

export function FeedbackFiltersSection({ controller }: FeedbackFiltersSectionProps) {
  return (
    <FeedbackFilters
      feedbackStatusFilter={controller.filters.feedbackStatusFilter}
      resultStatusFilter={controller.filters.resultStatusFilter}
      strategyFilter={controller.filters.strategyFilter}
      strategyOptions={controller.strategyOptions}
      onFeedbackStatusChange={controller.filters.setFeedbackStatusFilter}
      onResultStatusChange={controller.filters.setResultStatusFilter}
      onStrategyChange={controller.filters.setStrategyFilter}
      onReset={controller.handleResetFilters}
    />
  );
}
