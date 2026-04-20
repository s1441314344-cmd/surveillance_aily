import { DataStateBlock, SectionCard } from '@/shared/ui';

type AuditLogsAccessSectionProps = {
  canViewAuditLogs: boolean;
};

export function AuditLogsAccessSection({ canViewAuditLogs }: AuditLogsAccessSectionProps) {
  if (canViewAuditLogs) {
    return null;
  }

  return (
    <SectionCard title="权限提示" subtitle="当前账号无权限查看审计日志">
      <DataStateBlock error="审计日志仅开放给 system_admin。" />
    </SectionCard>
  );
}
