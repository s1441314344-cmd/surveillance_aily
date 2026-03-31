import { PageHeader, SectionCard } from '@/shared/ui';
import { FeedbackDetailPanel } from '@/pages/feedback/FeedbackDetailPanel';
import { FeedbackFilters } from '@/pages/feedback/FeedbackFilters';
import { FeedbackQueueSection } from '@/pages/feedback/FeedbackQueueSection';
import { FeedbackReviewForm } from '@/pages/feedback/FeedbackReviewForm';
import { useFeedbackPageController } from '@/pages/feedback/useFeedbackPageController';

export function FeedbackPage() {
  const {
    form,
    filters,
    selection,
    queries,
    actions,
    strategyOptions,
    handleResetFilters,
  } = useFeedbackPageController();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="人工复核"
        title="人工复核"
        description="结合图片与结构化 JSON 进行正确/错误判断，并记录修正信息。"
      />

      <FeedbackFilters
        feedbackStatusFilter={filters.feedbackStatusFilter}
        resultStatusFilter={filters.resultStatusFilter}
        strategyFilter={filters.strategyFilter}
        strategyOptions={strategyOptions}
        onFeedbackStatusChange={filters.setFeedbackStatusFilter}
        onResultStatusChange={filters.setResultStatusFilter}
        onStrategyChange={filters.setStrategyFilter}
        onReset={handleResetFilters}
      />

      <div className="page-grid page-grid--master-detail">
        <FeedbackQueueSection
          records={queries.records}
          loading={queries.recordsQuery.isLoading}
          selectedRecordId={selection.selectedRecordId}
          onSelectRecord={selection.handleSelectRecord}
        />

        <SectionCard title="复核详情" className="page-master-detail">
          <div className="page-master-detail__stack">
            <FeedbackReviewForm form={form} loading={actions.submitLoading} onSubmit={actions.handleSubmit} />
            <FeedbackDetailPanel detail={queries.detail} imagePreviewUrl={queries.imagePreviewUrl} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
