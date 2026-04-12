import type { PropsWithChildren, ReactNode } from 'react';
import { Space } from 'antd';

export function DetailPanel({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title?: ReactNode; subtitle?: ReactNode }>) {
  return (
    <div className="detail-panel">
      {title || subtitle ? (
        <div className="detail-panel__header">
          {title ? <div className="detail-panel__title">{title}</div> : null}
          {subtitle ? <div className="detail-panel__subtitle">{subtitle}</div> : null}
        </div>
      ) : null}
      <Space orientation="vertical" size={16} className="stack-full">
        {children}
      </Space>
    </div>
  );
}
