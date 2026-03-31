import { useMemo } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { JobSchedule } from '@/shared/api/tasks';

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

type UseJobsWorkspaceHandlersParams = {
  setScheduleFilter: (value: string) => void;
  setTriggerModeFilter: (value: string) => void;
  setCreatedFromFilter: (value: string) => void;
  setCreatedToFilter: (value: string) => void;
  setSelectedJobId: (value: string | null) => void;
  setSelectedScheduleId: (value: string | null) => void;
  setWorkspaceTab: (value: 'queue' | 'schedule') => void;
  setStatusFilter: (value: string) => void;
  setStrategyFilter: (value: string) => void;
  setCameraFilter: (value: string) => void;
  setScheduleStatusFilter: (value: string) => void;
  setScheduleCameraFilter: (value: string) => void;
  setScheduleStrategyFilter: (value: string) => void;
  handleResetQueueFilters: () => void;
  handleResetScheduleFilters: () => void;
  handleOpenScheduleEditor: (schedule: JobSchedule) => void;
  cancelMutation: UseMutationResult<unknown, Error, string, unknown>;
  retryMutation: UseMutationResult<unknown, Error, string, unknown>;
  runScheduleNowMutation: UseMutationResult<unknown, Error, string, unknown>;
  scheduleStatusMutation: UseMutationResult<unknown, Error, { scheduleId: string; status: string }, unknown>;
  deleteScheduleMutation: UseMutationResult<unknown, Error, string, unknown>;
};

export function useJobsWorkspaceHandlers({
  setScheduleFilter,
  setTriggerModeFilter,
  setCreatedFromFilter,
  setCreatedToFilter,
  setSelectedJobId,
  setSelectedScheduleId,
  setWorkspaceTab,
  setStatusFilter,
  setStrategyFilter,
  setCameraFilter,
  setScheduleStatusFilter,
  setScheduleCameraFilter,
  setScheduleStrategyFilter,
  handleResetQueueFilters,
  handleResetScheduleFilters,
  handleOpenScheduleEditor,
  cancelMutation,
  retryMutation,
  runScheduleNowMutation,
  scheduleStatusMutation,
  deleteScheduleMutation,
}: UseJobsWorkspaceHandlersParams) {
  const onQueueScheduleChange = createQueueScheduleChangeHandler(setScheduleFilter, setTriggerModeFilter);
  const onClearDateRange = createClearDateRangeHandler(setCreatedFromFilter, setCreatedToFilter);
  const onScheduleViewJobs = createScheduleViewJobsHandler(
    setWorkspaceTab,
    setTriggerModeFilter,
    setScheduleFilter,
    setSelectedJobId,
  );

  return useMemo(() => ({
    onQueueScheduleChange,
    onClearDateRange,
    onScheduleViewJobs,
    onCancelJob: (jobId: string) => cancelMutation.mutate(jobId),
    onRetryJob: (jobId: string) => retryMutation.mutate(jobId),
    onRunNow: (scheduleId: string) => runScheduleNowMutation.mutate(scheduleId),
    onToggleScheduleStatus: (scheduleId: string, status: string) =>
      scheduleStatusMutation.mutate({ scheduleId, status }),
    onDeleteSchedule: (scheduleId: string) => deleteScheduleMutation.mutate(scheduleId),
    onCloseJobDrawer: () => setSelectedJobId(null),
    onStatusChange: setStatusFilter,
    onStrategyChange: setStrategyFilter,
    onTriggerModeChange: setTriggerModeFilter,
    onCameraChange: setCameraFilter,
    onScheduleStatusFilterChange: setScheduleStatusFilter,
    onScheduleCameraFilterChange: setScheduleCameraFilter,
    onScheduleStrategyFilterChange: setScheduleStrategyFilter,
    onResetQueueFilters: handleResetQueueFilters,
    onResetScheduleFilters: handleResetScheduleFilters,
    onOpenScheduleEditor: handleOpenScheduleEditor,
    onSelectJob: setSelectedJobId,
    onSelectSchedule: setSelectedScheduleId,
  }), [
    cancelMutation,
    deleteScheduleMutation,
    handleOpenScheduleEditor,
    handleResetQueueFilters,
    handleResetScheduleFilters,
    onClearDateRange,
    onQueueScheduleChange,
    onScheduleViewJobs,
    retryMutation,
    runScheduleNowMutation,
    scheduleStatusMutation,
    setCameraFilter,
    setScheduleCameraFilter,
    setScheduleStatusFilter,
    setScheduleStrategyFilter,
    setSelectedJobId,
    setSelectedScheduleId,
    setStatusFilter,
    setStrategyFilter,
    setTriggerModeFilter,
    setWorkspaceTab,
  ]);
}
