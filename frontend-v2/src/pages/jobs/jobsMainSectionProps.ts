import type { JobCreatePanel } from '@/pages/jobs/JobCreatePanel';
import type { JobsWorkspaceTabs } from '@/pages/jobs/JobsWorkspaceTabs';
import { getCameraSelectOptions, getScheduleStatusFilterOptions } from '@/pages/jobs/jobsQueryUtils';
import type { useJobsPageController } from '@/pages/jobs/useJobsPageController';
import { JOB_UPLOAD_SOURCE_OPTIONS } from '@/pages/jobs/types';
import {
  SCHEDULE_TYPE_OPTIONS,
  TRIGGER_MODE_FILTER_OPTIONS,
} from '@/shared/ui';

type JobsPageController = ReturnType<typeof useJobsPageController>;

type JobCreatePanelProps = Parameters<typeof JobCreatePanel>[0];
type JobsWorkspaceTabsProps = Parameters<typeof JobsWorkspaceTabs>[0];

export function buildJobCreatePanelProps(controller: JobsPageController): JobCreatePanelProps {
  return {
    form: {
      form: controller.form,
    },
    workflow: {
      taskMode: controller.taskMode,
      uploadSource: controller.uploadSource,
      scheduleType: controller.scheduleType,
    },
    resources: {
      strategyLoading: controller.queries.strategyQuery.isLoading,
      cameraLoading: controller.queries.camerasQuery.isLoading,
    },
    state: {
      fileList: controller.workspace.draftState.fileList,
      hasUnsupportedCameraProtocol: controller.queries.hasUnsupportedCameraProtocol,
      hasUnsupportedUploadCameraProtocol: controller.queries.hasUnsupportedUploadCameraProtocol,
      submitLoading: controller.actions.submitLoading,
    },
    handlers: {
      onSubmit: controller.actions.handleUploadSubmit,
      onValuesChange: controller.actions.handleFormValuesChange,
      onFileListChange: controller.workspace.draftState.setFileList,
      onResetInput: controller.actions.handleResetInput,
    },
    options: {
      strategyOptions: controller.queries.strategySelectOptions,
      scheduleTypeOptions: SCHEDULE_TYPE_OPTIONS,
      uploadSourceOptions: JOB_UPLOAD_SOURCE_OPTIONS,
      cameraOptions: getCameraSelectOptions(controller.queries.cameras),
    },
  };
}

export function buildJobsWorkspaceTabsProps(controller: JobsPageController): JobsWorkspaceTabsProps {
  return {
    shared: {
      values: {
        workspaceTab: controller.workspace.selection.workspaceTab,
      },
      handlers: {
        onWorkspaceTabChange: controller.workspace.selection.setWorkspaceTab,
      },
    },
    queue: {
      filters: {
        values: {
          statusFilter: controller.workspace.queueFilters.statusFilter,
          strategyFilter: controller.workspace.queueFilters.strategyFilter,
          triggerModeFilter: controller.workspace.queueFilters.triggerModeFilter,
          cameraFilter: controller.workspace.queueFilters.cameraFilter,
          scheduleFilter: controller.workspace.queueFilters.scheduleFilter,
        },
        options: {
          statusOptions: controller.queries.jobStatusOptions,
          strategyOptions: controller.queries.strategyOptions,
          triggerModeOptions: [...TRIGGER_MODE_FILTER_OPTIONS],
          cameraOptions: controller.queries.cameraOptions,
          scheduleOptions: controller.queries.scheduleFilterOptions,
        },
        handlers: {
          onStatusChange: controller.handlers.onStatusChange,
          onStrategyChange: controller.handlers.onStrategyChange,
          onTriggerModeChange: controller.handlers.onTriggerModeChange,
          onCameraChange: controller.handlers.onCameraChange,
          onScheduleChange: controller.handlers.onQueueScheduleChange,
        },
      },
      timeRange: {
        values: {
          createdFromFilter: controller.workspace.queueFilters.createdFromFilter,
          createdToFilter: controller.workspace.queueFilters.createdToFilter,
        },
        handlers: {
          onCreatedFromChange: controller.workspace.queueFilters.setCreatedFromFilter,
          onCreatedToChange: controller.workspace.queueFilters.setCreatedToFilter,
          onClearDateRange: controller.handlers.onClearDateRange,
          onResetFilters: controller.handlers.onResetQueueFilters,
        },
      },
      table: {
        data: {
          jobs: controller.queries.jobs,
          cameras: controller.queries.cameras,
        },
        selection: {
          selectedJobId: controller.workspace.selection.selectedJobId,
        },
        state: {
          loading: controller.queries.jobsQuery.isLoading,
          cancelLoading: controller.mutations.cancelMutation.isPending,
          retryLoading: controller.mutations.retryMutation.isPending,
        },
        handlers: {
          onSelectJob: controller.handlers.onSelectJob,
          onCancelJob: controller.handlers.onCancelJob,
          onRetryJob: controller.handlers.onRetryJob,
        },
      },
    },
    schedule: {
      filters: {
        values: {
          scheduleStatusFilter: controller.workspace.scheduleFilters.scheduleStatusFilter,
          scheduleCameraFilter: controller.workspace.scheduleFilters.scheduleCameraFilter,
          scheduleStrategyFilter: controller.workspace.scheduleFilters.scheduleStrategyFilter,
        },
        options: {
          statusOptions: getScheduleStatusFilterOptions(),
          cameraOptions: controller.queries.cameraOptions,
          strategyOptions: controller.queries.strategyOptions,
        },
        handlers: {
          onScheduleStatusFilterChange: controller.handlers.onScheduleStatusFilterChange,
          onScheduleCameraFilterChange: controller.handlers.onScheduleCameraFilterChange,
          onScheduleStrategyFilterChange: controller.handlers.onScheduleStrategyFilterChange,
          onResetFilters: controller.handlers.onResetScheduleFilters,
        },
      },
      table: {
        data: {
          schedules: controller.queries.schedules,
          cameras: controller.queries.cameras,
          strategies: controller.queries.strategies,
        },
        selection: {
          selectedScheduleId: controller.workspace.selection.selectedScheduleId,
        },
        state: {
          loading: controller.queries.schedulesQuery.isLoading,
          scheduleStatusLoading: controller.mutations.scheduleStatusMutation.isPending,
          runNowLoading: controller.mutations.runScheduleNowMutation.isPending,
          updateLoading: controller.mutations.updateScheduleMutation.isPending,
          deleteLoading: controller.mutations.deleteScheduleMutation.isPending,
        },
        handlers: {
          onSelectSchedule: controller.handlers.onSelectSchedule,
          onViewJobs: controller.handlers.onScheduleViewJobs,
          onRunNow: controller.handlers.onRunNow,
          onEdit: controller.handlers.onOpenScheduleEditor,
          onToggleStatus: controller.handlers.onToggleScheduleStatus,
          onDelete: controller.handlers.onDeleteSchedule,
        },
      },
    },
  };
}
