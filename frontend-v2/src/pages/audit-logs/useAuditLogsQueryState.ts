import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/shared/api/auditLogs';
import { getApiErrorMessage } from '@/shared/api/errors';
import type { AuditLogFilterState } from '@/pages/audit-logs/types';

type UseAuditLogsQueryStateParams = {
  filters: AuditLogFilterState;
  canViewAuditLogs: boolean;
};

export function useAuditLogsQueryState({
  filters,
  canViewAuditLogs,
}: UseAuditLogsQueryStateParams) {
  const createdFrom = filters.range?.[0]?.toISOString();
  const createdTo = filters.range?.[1]?.toISOString();

  const auditLogsQuery = useQuery({
    queryKey: [
      'audit-logs',
      filters.httpMethod,
      filters.requestPath,
      filters.operatorUsername,
      filters.success,
      createdFrom,
      createdTo,
    ],
    queryFn: () =>
      listAuditLogs({
        httpMethod: filters.httpMethod || undefined,
        requestPath: filters.requestPath?.trim() || undefined,
        operatorUsername: filters.operatorUsername?.trim() || undefined,
        success: filters.success,
        createdFrom,
        createdTo,
        limit: 200,
      }),
    enabled: canViewAuditLogs,
  });

  const logs = useMemo(() => auditLogsQuery.data ?? [], [auditLogsQuery.data]);
  const auditError = auditLogsQuery.error ? getApiErrorMessage(auditLogsQuery.error, '审计日志加载失败') : null;

  return {
    createdFrom,
    createdTo,
    auditLogsQuery,
    logs,
    auditError,
  };
}
