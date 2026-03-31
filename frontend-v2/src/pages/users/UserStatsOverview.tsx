import { Space } from 'antd';
import { MetricCard, SectionCard } from '@/shared/ui';
type UserStatsSummary = {
  total: number;
  active: number;
  inactive: number;
  admins: number;
};

type UserStatsOverviewProps = {
  stats: UserStatsSummary;
};

export function UserStatsOverview({ stats }: UserStatsOverviewProps) {
  return (
    <SectionCard title="用户概览">
      <Space wrap size={16} className="stack-full">
        <MetricCard title="用户总数" value={stats.total} tone="primary" />
        <MetricCard title="启用用户" value={stats.active} tone="success" />
        <MetricCard title="停用用户" value={stats.inactive} tone="warning" />
        <MetricCard title="管理员数量" value={stats.admins} tone="danger" />
      </Space>
    </SectionCard>
  );
}
