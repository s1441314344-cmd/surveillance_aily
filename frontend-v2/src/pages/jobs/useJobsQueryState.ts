import { useQuery } from '@tanstack/react-query';
import { listCameras, listStrategies } from '@/shared/api/configCenter';
import {
  getJob,
  listJobs,
  listJobSchedules,
} from '@/shared/api/tasks';
import { JOBS_QUERY_KEYS } from '@/pages/jobs/jobsQueryKeys';
import { useJobsQueryDerivedState } from '@/pages/jobs/jobsQueryDerivedState';
import { buildJobsListParams, buildSchedulesListParams } from '@/pages/jobs/jobsQueryParams';
import { useMemo } from 'react';

const JOBS_REFETCH_INTERVAL_MS = 5000;
const SCHEDULES_REFETCH_INTERVAL_MS = 10000;

type UseJobsQueryStateParams = {
  statusFilter: string;
  strategyFilter: string;
  triggerModeFilter: string;
  cameraFilter: string;
  scheduleFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
  scheduleStatusFilter: string;
  scheduleCameraFilter: string;
  scheduleStrategyFilter: string;
  selectedJobId: string | null;
  taskMode: 'upload' | 'camera_once' | 'camera_schedule';
  uploadSource: 'local_file' | 'camera_snapshot';
  selectedCameraIdInForm?: string;
  selectedUploadCameraIdInForm?: string;
};

export function useJobsQueryState({
  statusFilter,
  strategyFilter,
  triggerModeFilter,
  cameraFilter,
  scheduleFilter,
  createdFromFilter,
  createdToFilter,
  scheduleStatusFilter,
  scheduleCameraFilter,
  scheduleStrategyFilter,
  selectedJobId,
  taskMode,
  uploadSource,
  selectedCameraIdInForm,
  selectedUploadCameraIdInForm,
}: UseJobsQueryStateParams) {
  const jobsListParams = useMemo(
    () =>
      buildJobsListParams({
        statusFilter,
        strategyFilter,
        triggerModeFilter,
        cameraFilter,
        scheduleFilter,
        createdFromFilter,
        createdToFilter,
      }),
    [
      statusFilter,
      strategyFilter,
      triggerModeFilter,
      cameraFilter,
      scheduleFilter,
      createdFromFilter,
      createdToFilter,
    ],
  );
  const schedulesListParams = useMemo(
    () =>
      buildSchedulesListParams({
        scheduleStatusFilter,
        scheduleCameraFilter,
        scheduleStrategyFilter,
      }),
    [scheduleStatusFilter, scheduleCameraFilter, scheduleStrategyFilter],
  );

  const strategyQuery = useQuery({
    queryKey: JOBS_QUERY_KEYS.strategiesActive,
    queryFn: () => listStrategies({ status: 'active' }),
  });

  const camerasQuery = useQuery({
    queryKey: JOBS_QUERY_KEYS.camerasForJobs,
    queryFn: listCameras,
  });

  const jobsQuery = useQuery({
    queryKey: JOBS_QUERY_KEYS.jobs(
      statusFilter,
      strategyFilter,
      triggerModeFilter,
      cameraFilter,
      scheduleFilter,
      createdFromFilter,
      createdToFilter,
    ),
    queryFn: () => listJobs(jobsListParams),
    refetchInterval: JOBS_REFETCH_INTERVAL_MS,
  });

  const schedulesQuery = useQuery({
    queryKey: JOBS_QUERY_KEYS.jobSchedules(
      scheduleStatusFilter,
      scheduleCameraFilter,
      scheduleStrategyFilter,
    ),
    queryFn: () => listJobSchedules(schedulesListParams),
    refetchInterval: SCHEDULES_REFETCH_INTERVAL_MS,
  });

  const selectedJobQuery = useQuery({
    queryKey: JOBS_QUERY_KEYS.jobDetail(selectedJobId),
    queryFn: () => getJob(selectedJobId as string),
    enabled: Boolean(selectedJobId),
  });

  const derivedState = useJobsQueryDerivedState({
    strategiesData: strategyQuery.data,
    camerasData: camerasQuery.data,
    jobsData: jobsQuery.data,
    schedulesData: schedulesQuery.data,
    selectedJobData: selectedJobQuery.data,
    taskMode,
    uploadSource,
    selectedCameraIdInForm,
    selectedUploadCameraIdInForm,
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
