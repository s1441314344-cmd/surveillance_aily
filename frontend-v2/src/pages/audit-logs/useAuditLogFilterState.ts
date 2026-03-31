import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { DEFAULT_AUDIT_FILTERS, type AuditLogFilterState } from '@/pages/audit-logs/types';

export function useAuditLogFilterState() {
  const [filters, setFilters] = useState<AuditLogFilterState>(DEFAULT_AUDIT_FILTERS);

  const setHttpMethod = (httpMethod: string | undefined) => {
    setFilters((prev) => ({ ...prev, httpMethod }));
  };

  const setSuccess = (success: boolean | undefined) => {
    setFilters((prev) => ({ ...prev, success }));
  };

  const setRequestPath = (requestPath: string) => {
    setFilters((prev) => ({ ...prev, requestPath }));
  };

  const setOperatorUsername = (operatorUsername: string) => {
    setFilters((prev) => ({ ...prev, operatorUsername }));
  };

  const setRange = (range: [Dayjs, Dayjs] | null) => {
    setFilters((prev) => ({ ...prev, range }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_AUDIT_FILTERS);
  };

  return {
    filters,
    setHttpMethod,
    setSuccess,
    setRequestPath,
    setOperatorUsername,
    setRange,
    resetFilters,
  };
}
