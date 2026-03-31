import type { ReactNode } from 'react';
import { Alert, Empty, Spin } from 'antd';

export type DataStateProps = {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyDescription?: ReactNode;
  children?: ReactNode;
  minHeight?: number;
};

const MIN_HEIGHT_CLASS_MAP: Record<number, string> = {
  120: 'data-state-block--h120',
  140: 'data-state-block--h140',
  180: 'data-state-block--h180',
  220: 'data-state-block--h220',
  240: 'data-state-block--h240',
  360: 'data-state-block--h360',
};

export function DataStateBlock({
  loading = false,
  error,
  empty = false,
  emptyDescription,
  children,
  minHeight = 220,
}: DataStateProps) {
  const minHeightClass =
    MIN_HEIGHT_CLASS_MAP[minHeight] ?? MIN_HEIGHT_CLASS_MAP[220];
  const containerClassName = `data-state-block ${minHeightClass}`;

  if (loading) {
    return (
      <div className={containerClassName}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" showIcon title="数据加载失败" description={error} />;
  }

  if (empty) {
    return (
      <div className={containerClassName}>
        <Empty description={emptyDescription ?? '暂无数据'} />
      </div>
    );
  }

  return <>{children}</>;
}
