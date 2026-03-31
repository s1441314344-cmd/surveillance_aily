import { PageHeader } from '@/shared/ui';
import { RecordDetailSection } from '@/pages/records/RecordDetailSection';
import { RecordsFilters } from '@/pages/records/RecordsFilters';
import { RecordsListSection } from '@/pages/records/RecordsListSection';
import { useRecordsPageController } from '@/pages/records/useRecordsPageController';

export function RecordsPage() {
  const {
    filters,
    queries,
    selectedRecordId,
    handleSelectRecord,
    exportActions,
    strategyOptions,
    cameraOptions,
    providerOptions,
  } = useRecordsPageController();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="数据记录"
        title="任务记录"
        description="查看记录、原图、结构化结果与人工反馈，按多维筛选后可导出 CSV/Excel。"
      />

      <RecordsFilters
        actions={exportActions}
        statusFilter={filters.statusFilter}
        strategyFilter={filters.strategyFilter}
        jobTypeFilter={filters.jobTypeFilter}
        cameraFilter={filters.cameraFilter}
        modelProviderFilter={filters.modelProviderFilter}
        feedbackFilter={filters.feedbackFilter}
        createdFromFilter={filters.createdFromFilter}
        createdToFilter={filters.createdToFilter}
        strategyOptions={strategyOptions}
        cameraOptions={cameraOptions}
        providerOptions={providerOptions}
        onStatusChange={filters.setStatusFilter}
        onStrategyChange={filters.setStrategyFilter}
        onJobTypeChange={filters.setJobTypeFilter}
        onCameraChange={filters.setCameraFilter}
        onModelProviderChange={filters.setModelProviderFilter}
        onFeedbackChange={filters.setFeedbackFilter}
        onCreatedFromChange={filters.setCreatedFromFilter}
        onCreatedToChange={filters.setCreatedToFilter}
      />

      <div className="page-grid page-grid--master-detail">
        <RecordsListSection
          records={queries.records}
          loading={queries.recordsQuery.isLoading}
          selectedRecordId={selectedRecordId}
          onSelectRecord={handleSelectRecord}
        />
        <RecordDetailSection detail={queries.detail} imagePreviewUrl={queries.imagePreviewUrl} />
      </div>
    </div>
  );
}
