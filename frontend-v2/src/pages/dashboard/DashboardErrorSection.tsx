import { DataStateBlock, SectionCard } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import type { useDashboardPageController } from '@/pages/dashboard/useDashboardPageController';

type DashboardPageController = ReturnType<typeof useDashboardPageController>;

type DashboardErrorSectionProps = {
  controller: DashboardPageController;
};

export function DashboardErrorSection({ controller }: DashboardErrorSectionProps) {
  if (!controller.queries.dashboardError) {
    return null;
  }

  return (
    <SectionCard title="加载状态">
      <DataStateBlock error={getApiErrorMessage(controller.queries.dashboardError, '数据加载失败')} />
    </SectionCard>
  );
}
