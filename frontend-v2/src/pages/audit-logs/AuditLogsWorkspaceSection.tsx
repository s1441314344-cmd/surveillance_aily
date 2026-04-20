import { Table } from 'antd';
import type { AuditLog } from '@/shared/api/auditLogs';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import { AuditLogFilters } from '@/pages/audit-logs/AuditLogFilters';
import type { useAuditLogsPageController } from '@/pages/audit-logs/useAuditLogsPageController';

type AuditLogsPageController = ReturnType<typeof useAuditLogsPageController>;

type AuditLogsWorkspaceSectionProps = {
  controller: AuditLogsPageController;
};

export function AuditLogsWorkspaceSection({ controller }: AuditLogsWorkspaceSectionProps) {
  if (!controller.canViewAuditLogs) {
    return null;
  }

  return (
    <SectionCard title="审计查询">
      <AuditLogFilters
        httpMethod={controller.filters.filters.httpMethod}
        success={controller.filters.filters.success}
        requestPath={controller.filters.filters.requestPath}
        operatorUsername={controller.filters.filters.operatorUsername}
        range={controller.filters.filters.range ?? null}
        onHttpMethodChange={controller.filters.setHttpMethod}
        onSuccessChange={controller.filters.setSuccess}
        onRequestPathChange={controller.filters.setRequestPath}
        onOperatorUsernameChange={controller.filters.setOperatorUsername}
        onRangeChange={controller.filters.setRange}
        onReset={controller.filters.resetFilters}
      />

      <DataStateBlock
        loading={controller.queries.auditLogsQuery.isLoading}
        error={controller.queries.auditError}
        empty={!controller.queries.auditLogsQuery.isLoading && controller.queries.logs.length === 0}
        emptyDescription="暂无审计日志"
      >
        <Table<AuditLog>
          rowKey="id"
          dataSource={controller.queries.logs}
          columns={controller.columns}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          onRow={(record) => ({
            onClick: () => controller.setSelectedAuditLogId(record.id),
            tabIndex: 0,
            'aria-selected': record.id === controller.selectedAuditLogId,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                controller.setSelectedAuditLogId(record.id);
              }
            },
          })}
          rowClassName={(record) =>
            `table-row-clickable ${record.id === controller.selectedAuditLogId ? 'table-row-selected' : ''}`
          }
        />
      </DataStateBlock>
    </SectionCard>
  );
}
