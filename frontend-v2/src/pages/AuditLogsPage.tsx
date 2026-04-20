import { RoutePageHeader } from '@/shared/ui';
import { AuditLogsAccessSection } from '@/pages/audit-logs/AuditLogsAccessSection';
import { AuditLogsWorkspaceSection } from '@/pages/audit-logs/AuditLogsWorkspaceSection';
import { useAuditLogsPageController } from '@/pages/audit-logs/useAuditLogsPageController';

export function AuditLogsPage() {
  const controller = useAuditLogsPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="审计记录覆盖写操作请求，用于安全追踪、问题排查与合规留痕。" />
      <AuditLogsAccessSection canViewAuditLogs={controller.canViewAuditLogs} />
      <AuditLogsWorkspaceSection controller={controller} />
    </div>
  );
}
