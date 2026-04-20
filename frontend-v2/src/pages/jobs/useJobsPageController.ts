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
  const { queueFilters, scheduleFilters, draftState, selection } = workspace;
  const {
    taskMode,
    uploadSource,
    scheduleType,
    selectedCameraIdInForm,
    selectedUploadCameraIdInForm,
  } = useJobsFormWatchState({ form });

  const queries = useJobsQueryState({
    queueFilters: {
      statusFilter: queueFilters.statusFilter,
      strategyFilter: queueFilters.strategyFilter,
      triggerModeFilter: queueFilters.triggerModeFilter,
      cameraFilter: queueFilters.cameraFilter,
      scheduleFilter: queueFilters.scheduleFilter,
      createdFromFilter: queueFilters.createdFromFilter,
      createdToFilter: queueFilters.createdToFilter,
    },
    scheduleFilters: {
      scheduleStatusFilter: scheduleFilters.scheduleStatusFilter,
      scheduleCameraFilter: scheduleFilters.scheduleCameraFilter,
      scheduleStrategyFilter: scheduleFilters.scheduleStrategyFilter,
    },
    selection: {
      selectedJobId: selection.selectedJobId,
    },
    workflow: {
      taskMode,
      uploadSource,
      selectedCameraIdInForm,
      selectedUploadCameraIdInForm,
    },
  });

  useEnsureDefaultJobStrategy({
    form,
    strategies: queries.strategies,
  });

  const mutations = useJobsMutationState({
    forms: {
      form,
      scheduleEditForm,
    },
    jobWorkflow: {
      setFileList: draftState.setFileList,
      setSelectedJobId: selection.setSelectedJobId,
    },
    scheduleWorkflow: {
      setTriggerModeFilter: queueFilters.setTriggerModeFilter,
      setScheduleFilter: queueFilters.setScheduleFilter,
      setEditingSchedule: selection.setEditingSchedule,
    },
  });

  const actions = useJobsFormActionState({
    forms: {
      form,
      scheduleEditForm,
    },
    workflow: {
      taskMode,
      uploadSource,
    },
    resources: {
      selectedCameraInForm: queries.selectedCameraInForm,
      selectedUploadCameraInForm: queries.selectedUploadCameraInForm,
    },
    draftState: {
      fileList: draftState.fileList,
      editingSchedule: selection.editingSchedule,
      setFileList: draftState.setFileList,
      setEditScheduleType: draftState.setEditScheduleType,
      setEditingSchedule: selection.setEditingSchedule,
    },
    mutations,
  });

  const handlers = useJobsWorkspaceHandlers({
    queueFilters: {
      setScheduleFilter: queueFilters.setScheduleFilter,
      setTriggerModeFilter: queueFilters.setTriggerModeFilter,
      setCreatedFromFilter: queueFilters.setCreatedFromFilter,
      setCreatedToFilter: queueFilters.setCreatedToFilter,
      setStatusFilter: queueFilters.setStatusFilter,
      setStrategyFilter: queueFilters.setStrategyFilter,
      setCameraFilter: queueFilters.setCameraFilter,
      handleResetQueueFilters: queueFilters.handleResetQueueFilters,
    },
    scheduleFilters: {
      setScheduleStatusFilter: scheduleFilters.setScheduleStatusFilter,
      setScheduleCameraFilter: scheduleFilters.setScheduleCameraFilter,
      setScheduleStrategyFilter: scheduleFilters.setScheduleStrategyFilter,
      handleResetScheduleFilters: scheduleFilters.handleResetScheduleFilters,
    },
    selection: {
      setSelectedJobId: selection.setSelectedJobId,
      setSelectedScheduleId: selection.setSelectedScheduleId,
      setWorkspaceTab: selection.setWorkspaceTab,
      handleOpenScheduleEditor: actions.handleOpenScheduleEditor,
    },
    mutations: {
      cancelMutation: mutations.cancelMutation,
      retryMutation: mutations.retryMutation,
      runScheduleNowMutation: mutations.runScheduleNowMutation,
      scheduleStatusMutation: mutations.scheduleStatusMutation,
      deleteScheduleMutation: mutations.deleteScheduleMutation,
    },
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
