import type { ReactNode } from 'react';
import { Card, Statistic } from 'antd';

export function MetricCard({
  title,
  value,
  suffix,
  tone,
}: {
  title: ReactNode;
  value: number | string;
  suffix?: ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  return (
    <Card className={tone ? `metric-card metric-card--${tone}` : 'metric-card'}>
      <Statistic title={title} value={value} suffix={suffix} />
    </Card>
  );
}
