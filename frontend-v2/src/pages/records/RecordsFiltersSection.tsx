import { RecordsFilters } from '@/pages/records/RecordsFilters';
import type { useRecordsPageController } from '@/pages/records/useRecordsPageController';

type RecordsPageController = ReturnType<typeof useRecordsPageController>;

type RecordsFiltersSectionProps = {
  controller: RecordsPageController;
};

export function RecordsFiltersSection({ controller }: RecordsFiltersSectionProps) {
  return (
    <RecordsFilters
      actions={controller.exportActions}
      statusFilter={controller.filters.statusFilter}
      strategyFilter={controller.filters.strategyFilter}
      jobTypeFilter={controller.filters.jobTypeFilter}
      cameraFilter={controller.filters.cameraFilter}
      modelProviderFilter={controller.filters.modelProviderFilter}
      feedbackFilter={controller.filters.feedbackFilter}
      createdFromFilter={controller.filters.createdFromFilter}
      createdToFilter={controller.filters.createdToFilter}
      strategyOptions={controller.strategyOptions}
      cameraOptions={controller.cameraOptions}
      providerOptions={controller.providerOptions}
      onStatusChange={controller.filters.setStatusFilter}
      onStrategyChange={controller.filters.setStrategyFilter}
      onJobTypeChange={controller.filters.setJobTypeFilter}
      onCameraChange={controller.filters.setCameraFilter}
      onModelProviderChange={controller.filters.setModelProviderFilter}
      onFeedbackChange={controller.filters.setFeedbackFilter}
      onCreatedFromChange={controller.filters.setCreatedFromFilter}
      onCreatedToChange={controller.filters.setCreatedToFilter}
    />
  );
}
