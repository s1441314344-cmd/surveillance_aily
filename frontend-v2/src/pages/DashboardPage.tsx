import { RoutePageHeader } from '@/shared/ui';
import { DashboardErrorSection } from '@/pages/dashboard/DashboardErrorSection';
import { DashboardFiltersSection } from '@/pages/dashboard/DashboardFiltersSection';
import { DashboardInsightsSection } from '@/pages/dashboard/DashboardInsightsSection';
import { useDashboardPageController } from '@/pages/dashboard/useDashboardPageController';

export function DashboardPage() {
  const controller = useDashboardPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="按任务、记录与复核数据呈现关键指标、趋势与异常案例。" />

      <DashboardFiltersSection controller={controller} />
      <DashboardInsightsSection controller={controller} />
      <DashboardErrorSection controller={controller} />
    </div>
  );
}
