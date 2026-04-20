import { useMemo } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { JobSchedule } from '@/shared/api/jobs';

function createQueueScheduleChangeHandler(
  setScheduleFilter: (value: string) => void,
  setTriggerModeFilter: (value: string) => void,
) {
  return (value: string) => {
    setScheduleFilter(value);
    if (value !== 'all') {
      setTriggerModeFilter('schedule');
    }
  };
}

function createClearDateRangeHandler(
  setCreatedFromFilter: (value: string) => void,
  setCreatedToFilter: (value: string) => void,
) {
  return () => {
    setCreatedFromFilter('');
    setCreatedToFilter('');
  };
}

function createScheduleViewJobsHandler(
  setWorkspaceTab: (value: 'queue' | 'schedule') => void,
  setTriggerModeFilter: (value: string) => void,
  setScheduleFilter: (value: string) => void,
  setSelectedJobId: (value: string | null) => void,
) {
  return (scheduleId: string) => {
    setWorkspaceTab('queue');
    setTriggerModeFilter('schedule');
    setScheduleFilter(scheduleId);
    setSelectedJobId(null);
  };
}

type UseJobsWorkspaceHandlersQueueFiltersParams = {
  setScheduleFilter: (value: string) => void;
  setTriggerModeFilter: (value: string) => void;
  setCreatedFromFilter: (value: string) => void;
  setCreatedToFilter: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setStrategyFilter: (value: string) => void;
  setCameraFilter: (value: string) => void;
  handleResetQueueFilters: () => void;
};

type UseJobsWorkspaceHandlersScheduleFiltersParams = {
  setScheduleStatusFilter: (value: string) => void;
  setScheduleCameraFilter: (value: string) => void;
  setScheduleStrategyFilter: (value: string) => void;
  handleResetScheduleFilters: () => void;
};

type UseJobsWorkspaceHandlersSelectionParams = {
  setSelectedJobId: (value: string | null) => void;
  setSelectedScheduleId: (value: string | null) => void;
  setWorkspaceTab: (value: 'queue' | 'schedule') => void;
  handleOpenScheduleEditor: (schedule: JobSchedule) => void;
};

type UseJobsWorkspaceHandlersMutationsParams = {
  cancelMutation: UseMutationResult<unknown, Error, string, unknown>;
  retryMutation: UseMutationResult<unknown, Error, string, unknown>;
  runScheduleNowMutation: UseMutationResult<unknown, Error, string, unknown>;
  scheduleStatusMutation: UseMutationResult<unknown, Error, { scheduleId: string; status: string }, unknown>;
  deleteScheduleMutation: UseMutationResult<unknown, Error, string, unknown>;
};

type UseJobsWorkspaceHandlersParams = {
  queueFilters: UseJobsWorkspaceHandlersQueueFiltersParams;
  scheduleFilters: UseJobsWorkspaceHandlersScheduleFiltersParams;
  selection: UseJobsWorkspaceHandlersSelectionParams;
  mutations: UseJobsWorkspaceHandlersMutationsParams;
};

type UseJobsWorkspaceHandlersLocalHandlers = {
  onQueueScheduleChange: (value: string) => void;
  onClearDateRange: () => void;
  onScheduleViewJobs: (scheduleId: string) => void;
};

function buildQueueHandlers({
  queueFilters,
  selection,
  mutations,
  localHandlers,
}: {
  queueFilters: UseJobsWorkspaceHandlersQueueFiltersParams;
  selection: UseJobsWorkspaceHandlersSelectionParams;
  mutations: UseJobsWorkspaceHandlersMutationsParams;
  localHandlers: UseJobsWorkspaceHandlersLocalHandlers;
}) {
  return {
    onQueueScheduleChange: localHandlers.onQueueScheduleChange,
    onClearDateRange: localHandlers.onClearDateRange,
    onCancelJob: (jobId: string) => mutations.cancelMutation.mutate(jobId),
    onRetryJob: (jobId: string) => mutations.retryMutation.mutate(jobId),
    onStatusChange: queueFilters.setStatusFilter,
    onStrategyChange: queueFilters.setStrategyFilter,
    onTriggerModeChange: queueFilters.setTriggerModeFilter,
    onCameraChange: queueFilters.setCameraFilter,
    onResetQueueFilters: queueFilters.handleResetQueueFilters,
    onSelectJob: selection.setSelectedJobId,
  };
}

function buildScheduleHandlers({
  scheduleFilters,
  selection,
  mutations,
  localHandlers,
}: {
  scheduleFilters: UseJobsWorkspaceHandlersScheduleFiltersParams;
  selection: UseJobsWorkspaceHandlersSelectionParams;
  mutations: UseJobsWorkspaceHandlersMutationsParams;
  localHandlers: UseJobsWorkspaceHandlersLocalHandlers;
}) {
  return {
    onScheduleViewJobs: localHandlers.onScheduleViewJobs,
    onRunNow: (scheduleId: string) => mutations.runScheduleNowMutation.mutate(scheduleId),
    onToggleScheduleStatus: (scheduleId: string, status: string) =>
      mutations.scheduleStatusMutation.mutate({ scheduleId, status }),
    onDeleteSchedule: (scheduleId: string) => mutations.deleteScheduleMutation.mutate(scheduleId),
    onScheduleStatusFilterChange: scheduleFilters.setScheduleStatusFilter,
    onScheduleCameraFilterChange: scheduleFilters.setScheduleCameraFilter,
    onScheduleStrategyFilterChange: scheduleFilters.setScheduleStrategyFilter,
    onResetScheduleFilters: scheduleFilters.handleResetScheduleFilters,
    onOpenScheduleEditor: selection.handleOpenScheduleEditor,
    onSelectSchedule: selection.setSelectedScheduleId,
  };
}

function buildOverlayHandlers({
  selection,
}: {
  selection: UseJobsWorkspaceHandlersSelectionParams;
}) {
  return {
    onCloseJobDrawer: () => selection.setSelectedJobId(null),
  };
}

export function useJobsWorkspaceHandlers({
  queueFilters,
  scheduleFilters,
  selection,
  mutations,
}: UseJobsWorkspaceHandlersParams) {
  const onQueueScheduleChange = createQueueScheduleChangeHandler(
    queueFilters.setScheduleFilter,
    queueFilters.setTriggerModeFilter,
  );
  const onClearDateRange = createClearDateRangeHandler(
    queueFilters.setCreatedFromFilter,
    queueFilters.setCreatedToFilter,
  );
  const onScheduleViewJobs = createScheduleViewJobsHandler(
    selection.setWorkspaceTab,
    queueFilters.setTriggerModeFilter,
    queueFilters.setScheduleFilter,
    selection.setSelectedJobId,
  );

  return useMemo(() => {
    const localHandlers = {
      onQueueScheduleChange,
      onClearDateRange,
      onScheduleViewJobs,
    };
    const queueHandlers = buildQueueHandlers({
      queueFilters,
      selection,
      mutations,
      localHandlers,
    });
    const scheduleHandlers = buildScheduleHandlers({
      scheduleFilters,
      selection,
      mutations,
      localHandlers,
    });
    const overlayHandlers = buildOverlayHandlers({
      selection,
    });

    return {
      ...queueHandlers,
      ...scheduleHandlers,
      ...overlayHandlers,
    };
  }, [
    mutations,
    onClearDateRange,
    onQueueScheduleChange,
    onScheduleViewJobs,
    queueFilters,
    scheduleFilters,
    selection,
  ]);
}
