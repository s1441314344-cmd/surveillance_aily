import { optionalFilterValue, parseDateFilter } from '@/pages/jobs/jobsQueryUtils';

type BuildJobsListParamsInput = {
  statusFilter: string;
  strategyFilter: string;
  triggerModeFilter: string;
  cameraFilter: string;
  scheduleFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
};

type BuildSchedulesListParamsInput = {
  scheduleStatusFilter: string;
  scheduleCameraFilter: string;
  scheduleStrategyFilter: string;
};

export const buildJobsListParams = ({
  statusFilter,
  strategyFilter,
  triggerModeFilter,
  cameraFilter,
  scheduleFilter,
  createdFromFilter,
  createdToFilter,
}: BuildJobsListParamsInput) => ({
  status: optionalFilterValue(statusFilter),
  strategyId: optionalFilterValue(strategyFilter),
  triggerMode: optionalFilterValue(triggerModeFilter),
  cameraId: optionalFilterValue(cameraFilter),
  scheduleId: optionalFilterValue(scheduleFilter),
  createdFrom: parseDateFilter(createdFromFilter),
  createdTo: parseDateFilter(createdToFilter),
});

export const buildSchedulesListParams = ({
  scheduleStatusFilter,
  scheduleCameraFilter,
  scheduleStrategyFilter,
}: BuildSchedulesListParamsInput) => ({
  status: optionalFilterValue(scheduleStatusFilter),
  cameraId: optionalFilterValue(scheduleCameraFilter),
  strategyId: optionalFilterValue(scheduleStrategyFilter),
});
