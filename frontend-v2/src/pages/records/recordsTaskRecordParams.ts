import { parseDateFilter, type RecordsFilterState } from '@/pages/records/types';

const SCHEDULE_ID_FILTER = '';

export function buildTaskRecordFilterParams(filters: RecordsFilterState) {
  return {
    status: filters.statusFilter === 'all' ? undefined : filters.statusFilter,
    strategyId: filters.strategyFilter === 'all' ? undefined : filters.strategyFilter,
    jobType: filters.jobTypeFilter === 'all' ? undefined : filters.jobTypeFilter,
    scheduleId: SCHEDULE_ID_FILTER || undefined,
    cameraId: filters.cameraFilter === 'all' ? undefined : filters.cameraFilter,
    modelProvider: filters.modelProviderFilter === 'all' ? undefined : filters.modelProviderFilter,
    feedbackStatus: filters.feedbackFilter === 'all' ? undefined : filters.feedbackFilter,
    createdFrom: parseDateFilter(filters.createdFromFilter),
    createdTo: parseDateFilter(filters.createdToFilter),
  };
}
