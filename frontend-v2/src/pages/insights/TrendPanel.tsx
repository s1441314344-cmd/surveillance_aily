import { Space, Typography } from 'antd';
import { SectionCard } from '@/shared/ui';

const { Text } = Typography;

export type TrendPoint = {
  label: string;
  value: number;
};

export function TrendPanel({ title, points }: { title: string; points: TrendPoint[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <SectionCard title={title} subtitle="最近 30 次任务变化">
      <Space direction="vertical" size={12} className="stack-full">
        <div className="trend-chart">
          {points.map((point) => {
            return (
              <div key={point.label} className={`trend-chart__bar ${toTrendBarHeightClass(point.value, max)}`}>
                <Text className="trend-chart__label">{point.label}</Text>
              </div>
            );
          })}
        </div>
        <Space size={20} wrap>
          {points.slice(-3).map((point) => (
            <div key={`${point.label}-callout`}>
              <Text strong>{point.value}</Text>
              <br />
              <Text type="secondary">{point.label}</Text>
            </div>
          ))}
        </Space>
      </Space>
    </SectionCard>
  );
}

function toTrendBarHeightClass(value: number, max: number): string {
  if (max <= 0) {
    return 'trend-chart__bar--h10';
  }
  const ratio = Math.max(0, Math.min(1, value / max));
  const height = Math.max(10, Math.ceil(ratio * 10) * 10);
  return `trend-chart__bar--h${height}`;
}
