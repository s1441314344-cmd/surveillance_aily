import { Space } from 'antd';
import { MetricCard } from '@/shared/ui';

export type MetricEntry = {
  title: string;
  value: number | string;
  suffix?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
};

export function MetricsGrid({ metrics }: { metrics: MetricEntry[] }) {
  return (
    <Space wrap size={16} className="metric-grid">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          suffix={metric.suffix}
          tone={metric.tone}
        />
      ))}
    </Space>
  );
}
