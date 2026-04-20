import { RecordDetailSection } from '@/pages/records/RecordDetailSection';
import { RecordsListSection } from '@/pages/records/RecordsListSection';
import type { useRecordsPageController } from '@/pages/records/useRecordsPageController';

type RecordsPageController = ReturnType<typeof useRecordsPageController>;

type RecordsWorkspaceSectionProps = {
  controller: RecordsPageController;
};

export function RecordsWorkspaceSection({ controller }: RecordsWorkspaceSectionProps) {
  return (
    <div className="page-grid page-grid--master-detail">
      <RecordsListSection
        records={controller.queries.records}
        loading={controller.queries.recordsQuery.isLoading}
        selectedRecordId={controller.selectedRecordId}
        onSelectRecord={controller.handleSelectRecord}
      />
      <RecordDetailSection
        detail={controller.queries.detail}
        imagePreviewUrl={controller.queries.imagePreviewUrl}
      />
    </div>
  );
}
