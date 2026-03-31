import { Space } from 'antd';
import { MetricCard } from '@/shared/ui';

type UserStatsCardsProps = {
  total: number;
  active: number;
  inactive: number;
  admins: number;
};

export function UserStatsCards({ total, active, inactive, admins }: UserStatsCardsProps) {
  return (
    <Space wrap size={16} className="stack-full">
      <MetricCard title="用户总数" value={total} tone="primary" />
      <MetricCard title="启用用户" value={active} tone="success" />
      <MetricCard title="停用用户" value={inactive} tone="warning" />
      <MetricCard title="管理员数量" value={admins} tone="danger" />
    </Space>
  );
}
