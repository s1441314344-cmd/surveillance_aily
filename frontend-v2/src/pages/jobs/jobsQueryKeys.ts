export const JOBS_QUERY_KEYS = {
  jobsRoot: ['jobs'] as const,
  jobSchedulesRoot: ['job-schedules'] as const,
  jobDetailRoot: ['job-detail'] as const,
  strategiesActive: ['strategies', 'active'] as const,
  camerasForJobs: ['cameras', 'for-jobs'] as const,
  jobs: (
    statusFilter: string,
    strategyFilter: string,
    triggerModeFilter: string,
    cameraFilter: string,
    scheduleFilter: string,
    createdFromFilter: string,
    createdToFilter: string,
  ) =>
    [
      'jobs',
      statusFilter,
      strategyFilter,
      triggerModeFilter,
      cameraFilter,
      scheduleFilter,
      createdFromFilter,
      createdToFilter,
    ] as const,
  jobSchedules: (scheduleStatusFilter: string, scheduleCameraFilter: string, scheduleStrategyFilter: string) =>
    ['job-schedules', scheduleStatusFilter, scheduleCameraFilter, scheduleStrategyFilter] as const,
  jobDetail: (selectedJobId: string | null) => ['job-detail', selectedJobId] as const,
};
