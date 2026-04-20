import { useQuery } from '@tanstack/react-query';
import { listCameras } from '@/shared/api/cameras';
import {
  getJob,
  listJobs,
  listJobSchedules,
} from '@/shared/api/jobs';
import { listStrategies } from '@/shared/api/strategies';
import { JOBS_QUERY_KEYS } from '@/pages/jobs/jobsQueryKeys';
import { useJobsQueryDerivedState } from '@/pages/jobs/jobsQueryDerivedState';
import { buildJobsListParams, buildSchedulesListParams } from '@/pages/jobs/jobsQueryParams';

const JOBS_REFETCH_INTERVAL_MS = 5000;
const SCHEDULES_REFETCH_INTERVAL_MS = 10000;

type UseJobsQueryStateQueueFiltersParams = {
  statusFilter: string;
  strategyFilter: string;
  triggerModeFilter: string;
  cameraFilter: string;
  scheduleFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
};

type UseJobsQueryStateScheduleFiltersParams = {
  scheduleStatusFilter: string;
  scheduleCameraFilter: string;
  scheduleStrategyFilter: string;
};

type UseJobsQueryStateSelectionParams = {
  selectedJobId: string | null;
};

type UseJobsQueryStateWorkflowParams = {
  taskMode: 'upload' | 'camera_once' | 'camera_schedule';
  uploadSource: 'local_file' | 'camera_snapshot';
  selectedCameraIdInForm?: string;
  selectedUploadCameraIdInForm?: string;
};

type UseJobsQueryStateParams = {
  queueFilters: UseJobsQueryStateQueueFiltersParams;
  scheduleFilters: UseJobsQueryStateScheduleFiltersParams;
  selection: UseJobsQueryStateSelectionParams;
  workflow: UseJobsQueryStateWorkflowParams;
};

function buildStrategyQueryOptions() {
  return {
    queryKey: JOBS_QUERY_KEYS.strategiesActive,
    queryFn: () => listStrategies({ status: 'active' }),
  };
}

function buildCamerasQueryOptions() {
  return {
    queryKey: JOBS_QUERY_KEYS.camerasForJobs,
    queryFn: listCameras,
  };
}

function buildJobsQueryOptions({
  queueFilters,
}: {
  queueFilters: UseJobsQueryStateQueueFiltersParams;
}) {
  const jobsListParams = buildJobsListParams(queueFilters);
  return {
    queryKey: JOBS_QUERY_KEYS.jobs(
      queueFilters.statusFilter,
      queueFilters.strategyFilter,
      queueFilters.triggerModeFilter,
      queueFilters.cameraFilter,
      queueFilters.scheduleFilter,
      queueFilters.createdFromFilter,
      queueFilters.createdToFilter,
    ),
    queryFn: () => listJobs(jobsListParams),
    refetchInterval: JOBS_REFETCH_INTERVAL_MS,
  };
}

function buildSchedulesQueryOptions({
  scheduleFilters,
}: {
  scheduleFilters: UseJobsQueryStateScheduleFiltersParams;
}) {
  const schedulesListParams = buildSchedulesListParams(scheduleFilters);
  return {
    queryKey: JOBS_QUERY_KEYS.jobSchedules(
      scheduleFilters.scheduleStatusFilter,
      scheduleFilters.scheduleCameraFilter,
      scheduleFilters.scheduleStrategyFilter,
    ),
    queryFn: () => listJobSchedules(schedulesListParams),
    refetchInterval: SCHEDULES_REFETCH_INTERVAL_MS,
  };
}

function buildSelectedJobQueryOptions({
  selectedJobId,
}: {
  selectedJobId: string | null;
}) {
  return {
    queryKey: JOBS_QUERY_KEYS.jobDetail(selectedJobId),
    queryFn: () => {
      if (!selectedJobId) {
        return Promise.reject(new Error('selectedJobId is required'));
      }
      return getJob(selectedJobId);
    },
    enabled: Boolean(selectedJobId),
  };
}

export function useJobsQueryState({
  queueFilters,
  scheduleFilters,
  selection,
  workflow,
}: UseJobsQueryStateParams) {
  const { selectedJobId } = selection;
  const { taskMode, uploadSource, selectedCameraIdInForm, selectedUploadCameraIdInForm } = workflow;

  const strategyQuery = useQuery(buildStrategyQueryOptions());
  const camerasQuery = useQuery(buildCamerasQueryOptions());
  const jobsQuery = useQuery(buildJobsQueryOptions({
    queueFilters,
  }));
  const schedulesQuery = useQuery(buildSchedulesQueryOptions({
    scheduleFilters,
  }));
  const selectedJobQuery = useQuery(buildSelectedJobQueryOptions({
    selectedJobId,
  }));

  const derivedState = useJobsQueryDerivedState({
    queryData: {
      strategiesData: strategyQuery.data,
      camerasData: camerasQuery.data,
      jobsData: jobsQuery.data,
      schedulesData: schedulesQuery.data,
      selectedJobData: selectedJobQuery.data,
    },
    workflow: {
      taskMode,
      uploadSource,
    },
    selection: {
      selectedCameraIdInForm,
      selectedUploadCameraIdInForm,
    },
  });

  return {
    strategyQuery,
    camerasQuery,
    jobsQuery,
    schedulesQuery,
    selectedJobQuery,
    ...derivedState,
  };
}
