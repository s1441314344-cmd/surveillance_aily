import { Form } from 'antd';
import { useJobsFormActionState } from '@/pages/jobs/useJobsFormActionState';
import { useJobsMutationState } from '@/pages/jobs/useJobsMutationState';
import { useJobsQueryState } from '@/pages/jobs/useJobsQueryState';
import { useJobsWorkspaceHandlers } from '@/pages/jobs/useJobsWorkspaceHandlers';
import { useJobsWorkspaceState } from '@/pages/jobs/useJobsWorkspaceState';
import { type EditScheduleFormValues, type UploadFormValues } from '@/pages/jobs/types';
import { mapJobToDetailView } from '@/pages/jobs/jobDetailMapper';
import { useEnsureDefaultJobStrategy } from '@/pages/jobs/useEnsureDefaultJobStrategy';
import { useJobsFormWatchState } from '@/pages/jobs/useJobsFormWatchState';

export function useJobsPageController() {
  const [form] = Form.useForm<UploadFormValues>();
  const [scheduleEditForm] = Form.useForm<EditScheduleFormValues>();
  const workspace = useJobsWorkspaceState();
  const {
    taskMode,
    uploadSource,
    scheduleType,
    selectedCameraIdInForm,
    selectedUploadCameraIdInForm,
  } = useJobsFormWatchState({ form });

  const queries = useJobsQueryState({
    statusFilter: workspace.statusFilter,
    strategyFilter: workspace.strategyFilter,
    triggerModeFilter: workspace.triggerModeFilter,
    cameraFilter: workspace.cameraFilter,
    scheduleFilter: workspace.scheduleFilter,
    createdFromFilter: workspace.createdFromFilter,
    createdToFilter: workspace.createdToFilter,
    scheduleStatusFilter: workspace.scheduleStatusFilter,
    scheduleCameraFilter: workspace.scheduleCameraFilter,
    scheduleStrategyFilter: workspace.scheduleStrategyFilter,
    selectedJobId: workspace.selectedJobId,
    taskMode,
    uploadSource,
    selectedCameraIdInForm,
    selectedUploadCameraIdInForm,
  });

  useEnsureDefaultJobStrategy({
    form,
    strategies: queries.strategies,
  });

  const mutations = useJobsMutationState({
    form,
    scheduleEditForm,
    setFileList: workspace.setFileList,
    setSelectedJobId: workspace.setSelectedJobId,
    setTriggerModeFilter: workspace.setTriggerModeFilter,
    setScheduleFilter: workspace.setScheduleFilter,
    setEditingSchedule: workspace.setEditingSchedule,
  });

  const actions = useJobsFormActionState({
    form,
    scheduleEditForm,
    taskMode,
    uploadSource,
    fileList: workspace.fileList,
    selectedCameraInForm: queries.selectedCameraInForm,
    selectedUploadCameraInForm: queries.selectedUploadCameraInForm,
    editingSchedule: workspace.editingSchedule,
    setFileList: workspace.setFileList,
    setEditScheduleType: workspace.setEditScheduleType,
    setEditingSchedule: workspace.setEditingSchedule,
    mutations,
  });

  const handlers = useJobsWorkspaceHandlers({
    setScheduleFilter: workspace.setScheduleFilter,
    setTriggerModeFilter: workspace.setTriggerModeFilter,
    setCreatedFromFilter: workspace.setCreatedFromFilter,
    setCreatedToFilter: workspace.setCreatedToFilter,
    setSelectedJobId: workspace.setSelectedJobId,
    setSelectedScheduleId: workspace.setSelectedScheduleId,
    setWorkspaceTab: workspace.setWorkspaceTab,
    setStatusFilter: workspace.setStatusFilter,
    setStrategyFilter: workspace.setStrategyFilter,
    setCameraFilter: workspace.setCameraFilter,
    setScheduleStatusFilter: workspace.setScheduleStatusFilter,
    setScheduleCameraFilter: workspace.setScheduleCameraFilter,
    setScheduleStrategyFilter: workspace.setScheduleStrategyFilter,
    handleResetQueueFilters: workspace.handleResetQueueFilters,
    handleResetScheduleFilters: workspace.handleResetScheduleFilters,
    handleOpenScheduleEditor: actions.handleOpenScheduleEditor,
    cancelMutation: mutations.cancelMutation,
    retryMutation: mutations.retryMutation,
    runScheduleNowMutation: mutations.runScheduleNowMutation,
    scheduleStatusMutation: mutations.scheduleStatusMutation,
    deleteScheduleMutation: mutations.deleteScheduleMutation,
  });

  const jobDetail = mapJobToDetailView(queries.selectedJob);

  return {
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
  };
}
