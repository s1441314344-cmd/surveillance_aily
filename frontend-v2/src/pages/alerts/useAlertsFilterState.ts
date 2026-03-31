import { useCallback, useState } from 'react';

const ALERTS_FILTER_DEFAULTS = {
  statusFilter: 'all',
  severityFilter: 'all',
  keyword: '',
} as const;

export function useAlertsFilterState() {
  const [statusFilter, setStatusFilter] = useState<string>(ALERTS_FILTER_DEFAULTS.statusFilter);
  const [severityFilter, setSeverityFilter] = useState<string>(ALERTS_FILTER_DEFAULTS.severityFilter);
  const [keyword, setKeyword] = useState<string>(ALERTS_FILTER_DEFAULTS.keyword);
  const resetFilters = useCallback(() => {
    setStatusFilter(ALERTS_FILTER_DEFAULTS.statusFilter);
    setSeverityFilter(ALERTS_FILTER_DEFAULTS.severityFilter);
    setKeyword(ALERTS_FILTER_DEFAULTS.keyword);
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    severityFilter,
    setSeverityFilter,
    keyword,
    setKeyword,
    resetFilters,
  };
}
