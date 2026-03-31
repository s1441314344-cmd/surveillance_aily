export const parseDateFilter = (value: string) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const formatTimestamp = (value: string | null) => (value ? new Date(value).toLocaleString() : '-');

export type RecordsFilterState = {
  statusFilter: string;
  strategyFilter: string;
  jobTypeFilter: string;
  cameraFilter: string;
  modelProviderFilter: string;
  feedbackFilter: string;
  createdFromFilter: string;
  createdToFilter: string;
};

export const RECORDS_FILTER_DEFAULTS: RecordsFilterState = {
  statusFilter: 'all',
  strategyFilter: 'all',
  jobTypeFilter: 'all',
  cameraFilter: 'all',
  modelProviderFilter: 'all',
  feedbackFilter: 'all',
  createdFromFilter: '',
  createdToFilter: '',
};
