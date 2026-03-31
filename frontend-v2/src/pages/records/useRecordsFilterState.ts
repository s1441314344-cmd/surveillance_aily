import { useCallback, useState } from 'react';
import { RECORDS_FILTER_DEFAULTS } from '@/pages/records/types';

export function useRecordsFilterState() {
  const [statusFilter, setStatusFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.statusFilter);
  const [strategyFilter, setStrategyFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.strategyFilter);
  const [jobTypeFilter, setJobTypeFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.jobTypeFilter);
  const [cameraFilter, setCameraFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.cameraFilter);
  const [modelProviderFilter, setModelProviderFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.modelProviderFilter);
  const [feedbackFilter, setFeedbackFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.feedbackFilter);
  const [createdFromFilter, setCreatedFromFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.createdFromFilter);
  const [createdToFilter, setCreatedToFilter] = useState<string>(RECORDS_FILTER_DEFAULTS.createdToFilter);

  const resetFilters = useCallback(() => {
    setStatusFilter(RECORDS_FILTER_DEFAULTS.statusFilter);
    setStrategyFilter(RECORDS_FILTER_DEFAULTS.strategyFilter);
    setJobTypeFilter(RECORDS_FILTER_DEFAULTS.jobTypeFilter);
    setCameraFilter(RECORDS_FILTER_DEFAULTS.cameraFilter);
    setModelProviderFilter(RECORDS_FILTER_DEFAULTS.modelProviderFilter);
    setFeedbackFilter(RECORDS_FILTER_DEFAULTS.feedbackFilter);
    setCreatedFromFilter(RECORDS_FILTER_DEFAULTS.createdFromFilter);
    setCreatedToFilter(RECORDS_FILTER_DEFAULTS.createdToFilter);
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    strategyFilter,
    setStrategyFilter,
    jobTypeFilter,
    setJobTypeFilter,
    cameraFilter,
    setCameraFilter,
    modelProviderFilter,
    setModelProviderFilter,
    feedbackFilter,
    setFeedbackFilter,
    createdFromFilter,
    setCreatedFromFilter,
    createdToFilter,
    setCreatedToFilter,
    resetFilters,
  };
}
