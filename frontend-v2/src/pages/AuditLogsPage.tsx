import { useState } from 'react';
import {
  Table,
} from 'antd';
import type { AuditLog } from '@/shared/api/auditLogs';
import { useAuthStore } from '@/shared/state/authStore';
import { DataStateBlock, PageHeader, SectionCard } from '@/shared/ui';
import { AuditLogFilters } from '@/pages/audit-logs/AuditLogFilters';
import { useAuditLogFilterState } from '@/pages/audit-logs/useAuditLogFilterState';
import { useAuditLogTableColumns } from '@/pages/audit-logs/useAuditLogTableColumns';
import { useAuditLogsQueryState } from '@/pages/audit-logs/useAuditLogsQueryState';

export function AuditLogsPage() {
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null);
  const {
    filters,
    setHttpMethod,
    setSuccess,
    setRequestPath,
    setOperatorUsername,
    setRange,
    resetFilters,
  } = useAuditLogFilterState();
  const currentUser = useAuthStore((state) => state.user);
  const canViewAuditLogs = currentUser?.roles.includes('system_admin') ?? false;
  const { auditLogsQuery, logs, auditError } = useAuditLogsQueryState({ filters, canViewAuditLogs });
  const columns = useAuditLogTableColumns();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="治理审计"
        title="操作审计日志"
        description="审计记录覆盖写操作请求，用于安全追踪、问题排查与合规留痕。"
      />

      {!canViewAuditLogs ? (
        <SectionCard title="权限提示" subtitle="当前账号无权限查看审计日志">
          <DataStateBlock error="审计日志仅开放给 system_admin。" />
        </SectionCard>
      ) : (
        <SectionCard title="审计查询">
          <AuditLogFilters
            httpMethod={filters.httpMethod}
            success={filters.success}
            requestPath={filters.requestPath}
            operatorUsername={filters.operatorUsername}
            range={filters.range ?? null}
            onHttpMethodChange={setHttpMethod}
            onSuccessChange={setSuccess}
            onRequestPathChange={setRequestPath}
            onOperatorUsernameChange={setOperatorUsername}
            onRangeChange={setRange}
            onReset={resetFilters}
          />

          <DataStateBlock
            loading={auditLogsQuery.isLoading}
            error={auditError}
            empty={!auditLogsQuery.isLoading && logs.length === 0}
            emptyDescription="暂无审计日志"
          >
            <Table<AuditLog>
              rowKey="id"
              dataSource={logs}
              columns={columns}
              scroll={{ x: 1200 }}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              onRow={(record) => ({
                onClick: () => setSelectedAuditLogId(record.id),
                tabIndex: 0,
                'aria-selected': record.id === selectedAuditLogId,
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAuditLogId(record.id);
                  }
                },
              })}
              rowClassName={(record) => `table-row-clickable ${record.id === selectedAuditLogId ? 'table-row-selected' : ''}`}
            />
          </DataStateBlock>
        </SectionCard>
      )}
    </div>
  );
}
