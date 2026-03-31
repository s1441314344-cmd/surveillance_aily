import { PageHeader } from '@/shared/ui';
import { JobCreatePanel } from '@/pages/jobs/JobCreatePanel';
import { JobDetailDrawer } from '@/pages/jobs/JobDetailDrawer';
import { JobsWorkspaceTabs } from '@/pages/jobs/JobsWorkspaceTabs';
import { ScheduleEditModal } from '@/pages/jobs/ScheduleEditModal';
import { useJobsPageController } from '@/pages/jobs/useJobsPageController';

export function JobsPage() {
  const {
    form,
    scheduleEditForm,
    taskMode,
    uploadSource,
    scheduleType,
    workspace,
    queries,
    mutations,
    actions,
    handlers,
    jobDetail,
  } = useJobsPageController();
  const isJobDrawerOpen = Boolean(workspace.selectedJobId);
  const isScheduleEditorOpen = Boolean(workspace.editingSchedule);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="任务执行"
        title="任务中心"
        description="图片上传、摄像头单次任务和定时计划统一进入异步队列；worker 执行分析，scheduler 触发到期计划。"
      />

      <div className="page-grid page-grid--sidebar">
        <JobCreatePanel
          form={form}
          taskMode={taskMode}
          uploadSource={uploadSource}
          scheduleType={scheduleType}
          strategies={queries.strategies}
          cameras={queries.cameras}
          strategyLoading={queries.strategyQuery.isLoading}
          cameraLoading={queries.camerasQuery.isLoading}
          fileList={workspace.fileList}
          hasUnsupportedCameraProtocol={queries.hasUnsupportedCameraProtocol}
          hasUnsupportedUploadCameraProtocol={queries.hasUnsupportedUploadCameraProtocol}
          submitLoading={actions.submitLoading}
          onSubmit={actions.handleUploadSubmit}
          onValuesChange={actions.handleFormValuesChange}
          onFileListChange={workspace.setFileList}
          onResetInput={actions.handleResetInput}
        />

        <JobsWorkspaceTabs
          workspaceTab={workspace.workspaceTab}
          onWorkspaceTabChange={workspace.setWorkspaceTab}
          jobs={queries.jobs}
          schedules={queries.schedules}
          cameras={queries.cameras}
          strategies={queries.strategies}
          selectedJobId={workspace.selectedJobId}
          selectedScheduleId={workspace.selectedScheduleId}
          jobsLoading={queries.jobsQuery.isLoading}
          schedulesLoading={queries.schedulesQuery.isLoading}
          cancelLoading={mutations.cancelMutation.isPending}
          retryLoading={mutations.retryMutation.isPending}
          scheduleStatusLoading={mutations.scheduleStatusMutation.isPending}
          runNowLoading={mutations.runScheduleNowMutation.isPending}
          updateLoading={mutations.updateScheduleMutation.isPending}
          deleteLoading={mutations.deleteScheduleMutation.isPending}
          statusFilter={workspace.statusFilter}
          strategyFilter={workspace.strategyFilter}
          triggerModeFilter={workspace.triggerModeFilter}
          cameraFilter={workspace.cameraFilter}
          scheduleFilter={workspace.scheduleFilter}
          createdFromFilter={workspace.createdFromFilter}
          createdToFilter={workspace.createdToFilter}
          scheduleStatusFilter={workspace.scheduleStatusFilter}
          scheduleCameraFilter={workspace.scheduleCameraFilter}
          scheduleStrategyFilter={workspace.scheduleStrategyFilter}
          statusOptions={queries.jobStatusOptions}
          strategyOptions={queries.strategyOptions}
          cameraOptions={queries.cameraOptions}
          scheduleOptions={queries.scheduleFilterOptions}
          onStatusChange={handlers.onStatusChange}
          onStrategyChange={handlers.onStrategyChange}
          onTriggerModeChange={handlers.onTriggerModeChange}
          onCameraChange={handlers.onCameraChange}
          onQueueScheduleChange={handlers.onQueueScheduleChange}
          onCreatedFromChange={workspace.setCreatedFromFilter}
          onCreatedToChange={workspace.setCreatedToFilter}
          onClearDateRange={handlers.onClearDateRange}
          onResetQueueFilters={handlers.onResetQueueFilters}
          onSelectJob={handlers.onSelectJob}
          onCancelJob={handlers.onCancelJob}
          onRetryJob={handlers.onRetryJob}
          onScheduleStatusFilterChange={handlers.onScheduleStatusFilterChange}
          onScheduleCameraFilterChange={handlers.onScheduleCameraFilterChange}
          onScheduleStrategyFilterChange={handlers.onScheduleStrategyFilterChange}
          onResetScheduleFilters={handlers.onResetScheduleFilters}
          onSelectSchedule={handlers.onSelectSchedule}
          onScheduleViewJobs={handlers.onScheduleViewJobs}
          onRunNow={handlers.onRunNow}
          onEditSchedule={handlers.onOpenScheduleEditor}
          onToggleScheduleStatus={handlers.onToggleScheduleStatus}
          onDeleteSchedule={handlers.onDeleteSchedule}
        />
      </div>

      <JobDetailDrawer
        open={isJobDrawerOpen}
        onClose={handlers.onCloseJobDrawer}
        job={jobDetail}
      />

      <ScheduleEditModal
        open={isScheduleEditorOpen}
        form={scheduleEditForm}
        scheduleType={workspace.editScheduleType}
        strategies={queries.strategies}
        strategyLoading={queries.strategyQuery.isLoading}
        confirmLoading={mutations.updateScheduleMutation.isPending}
        onCancel={actions.handleCloseScheduleEditor}
        onSubmit={actions.handleSubmitScheduleEdit}
        onScheduleTypeChange={workspace.setEditScheduleType}
      />
    </div>
  );
}
