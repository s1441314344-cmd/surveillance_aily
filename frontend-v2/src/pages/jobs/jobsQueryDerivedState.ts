import { useMemo } from 'react';
import type { Camera, Strategy } from '@/shared/api/configCenter';
import type { Job, JobSchedule } from '@/shared/api/tasks';
import {
  getCameraOptions,
  getJobStatusOptions,
  getScheduleFilterOptions,
  getStrategyOptions,
} from '@/pages/jobs/jobsQueryUtils';

const EMPTY_STRATEGIES: Strategy[] = [];
const EMPTY_CAMERAS: Camera[] = [];
const EMPTY_JOBS: Job[] = [];
const EMPTY_JOB_SCHEDULES: JobSchedule[] = [];

type UseJobsQueryDerivedStateParams = {
  strategiesData: Strategy[] | undefined;
  camerasData: Camera[] | undefined;
  jobsData: Job[] | undefined;
  schedulesData: JobSchedule[] | undefined;
  selectedJobData: Job | undefined;
  taskMode: 'upload' | 'camera_once' | 'camera_schedule';
  uploadSource: 'local_file' | 'camera_snapshot';
  selectedCameraIdInForm?: string;
  selectedUploadCameraIdInForm?: string;
};

export function useJobsQueryDerivedState({
  strategiesData,
  camerasData,
  jobsData,
  schedulesData,
  selectedJobData,
  taskMode,
  uploadSource,
  selectedCameraIdInForm,
  selectedUploadCameraIdInForm,
}: UseJobsQueryDerivedStateParams) {
  const strategies = strategiesData ?? EMPTY_STRATEGIES;
  const cameras = camerasData ?? EMPTY_CAMERAS;
  const jobs = jobsData ?? EMPTY_JOBS;
  const schedules = schedulesData ?? EMPTY_JOB_SCHEDULES;
  const selectedJob = useMemo(() => selectedJobData ?? null, [selectedJobData]);
  const selectedCameraInForm = useMemo(
    () => cameras.find((item) => item.id === selectedCameraIdInForm) ?? null,
    [cameras, selectedCameraIdInForm],
  );
  const selectedUploadCameraInForm = useMemo(
    () => cameras.find((item) => item.id === selectedUploadCameraIdInForm) ?? null,
    [cameras, selectedUploadCameraIdInForm],
  );

  const hasUnsupportedCameraProtocol =
    taskMode !== 'upload' &&
    Boolean(selectedCameraInForm) &&
    (selectedCameraInForm?.protocol || '').toLowerCase() !== 'rtsp';

  const hasUnsupportedUploadCameraProtocol =
    taskMode === 'upload' &&
    uploadSource === 'camera_snapshot' &&
    Boolean(selectedUploadCameraInForm) &&
    (selectedUploadCameraInForm?.protocol || '').toLowerCase() !== 'rtsp';

  const scheduleFilterOptions = useMemo(() => getScheduleFilterOptions(schedules), [schedules]);
  const jobStatusOptions = useMemo(() => getJobStatusOptions(), []);
  const strategyOptions = useMemo(() => getStrategyOptions(strategies), [strategies]);
  const cameraOptions = useMemo(() => getCameraOptions(cameras), [cameras]);

  return {
    strategies,
    cameras,
    jobs,
    schedules,
    selectedJob,
    selectedCameraInForm,
    selectedUploadCameraInForm,
    hasUnsupportedCameraProtocol,
    hasUnsupportedUploadCameraProtocol,
    scheduleFilterOptions,
    jobStatusOptions,
    strategyOptions,
    cameraOptions,
  };
}
