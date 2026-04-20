import { RoutePageHeader } from '@/shared/ui';
import { RecordsFiltersSection } from '@/pages/records/RecordsFiltersSection';
import { RecordsWorkspaceSection } from '@/pages/records/RecordsWorkspaceSection';
import { useRecordsPageController } from '@/pages/records/useRecordsPageController';

export function RecordsPage() {
  const controller = useRecordsPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="查看记录、原图、结构化结果与人工反馈，按多维筛选后可导出 CSV/Excel。" />
      <RecordsFiltersSection controller={controller} />
      <RecordsWorkspaceSection controller={controller} />
    </div>
  );
}
