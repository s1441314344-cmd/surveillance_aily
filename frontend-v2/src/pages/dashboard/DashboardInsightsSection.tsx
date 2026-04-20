import { MetricsGrid } from '@/pages/insights/MetricsGrid';
import { TrendPanel } from '@/pages/insights/TrendPanel';
import { AnomalyTable } from '@/pages/insights/AnomalyTable';
import { SectionCard } from '@/shared/ui';
import type { useDashboardPageController } from '@/pages/dashboard/useDashboardPageController';

type DashboardPageController = ReturnType<typeof useDashboardPageController>;

type DashboardInsightsSectionProps = {
  controller: DashboardPageController;
};

export function DashboardInsightsSection({ controller }: DashboardInsightsSectionProps) {
  return (
    <>
      <SectionCard title="核心指标" subtitle="任务规模、结构化质量与反馈闭环概览">
        <MetricsGrid metrics={controller.queries.metricItems} />
      </SectionCard>

      <TrendPanel title="任务趋势" points={controller.queries.trendPoints} />

      <AnomalyTable
        data={controller.anomalyRows}
        loading={controller.queries.anomaliesQuery.isLoading}
      />
    </>
  );
}
