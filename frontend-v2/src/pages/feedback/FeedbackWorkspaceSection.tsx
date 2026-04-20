import { SectionCard } from '@/shared/ui';
import { FeedbackDetailPanel } from '@/pages/feedback/FeedbackDetailPanel';
import { FeedbackQueueSection } from '@/pages/feedback/FeedbackQueueSection';
import { FeedbackReviewForm } from '@/pages/feedback/FeedbackReviewForm';
import type { useFeedbackPageController } from '@/pages/feedback/useFeedbackPageController';

type FeedbackPageController = ReturnType<typeof useFeedbackPageController>;

type FeedbackWorkspaceSectionProps = {
  controller: FeedbackPageController;
};

export function FeedbackWorkspaceSection({ controller }: FeedbackWorkspaceSectionProps) {
  return (
    <div className="page-grid page-grid--master-detail">
      <FeedbackQueueSection
        records={controller.queries.records}
        loading={controller.queries.recordsQuery.isLoading}
        selectedRecordId={controller.selection.selectedRecordId}
        onSelectRecord={controller.selection.handleSelectRecord}
      />

      <SectionCard title="复核详情" className="page-master-detail">
        <div className="page-master-detail__stack">
          <FeedbackReviewForm
            form={controller.form}
            loading={controller.actions.submitLoading}
            onSubmit={controller.actions.handleSubmit}
          />
          <FeedbackDetailPanel
            detail={controller.queries.detail}
            imagePreviewUrl={controller.queries.imagePreviewUrl}
          />
        </div>
      </SectionCard>
    </div>
  );
}
