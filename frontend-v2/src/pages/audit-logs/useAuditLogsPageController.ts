import { useState } from 'react';
import { useAuthStore } from '@/shared/state/authStore';
import { useAuditLogFilterState } from '@/pages/audit-logs/useAuditLogFilterState';
import { useAuditLogTableColumns } from '@/pages/audit-logs/useAuditLogTableColumns';
import { useAuditLogsQueryState } from '@/pages/audit-logs/useAuditLogsQueryState';

export function useAuditLogsPageController() {
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null);
  const filters = useAuditLogFilterState();
  const currentUser = useAuthStore((state) => state.user);
  const canViewAuditLogs = currentUser?.roles.includes('system_admin') ?? false;
  const queries = useAuditLogsQueryState({ filters: filters.filters, canViewAuditLogs });
  const columns = useAuditLogTableColumns();

  return {
    filters,
    queries,
    columns,
    selectedAuditLogId,
    setSelectedAuditLogId,
    canViewAuditLogs,
  };
}
