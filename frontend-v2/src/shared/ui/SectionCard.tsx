import type { PropsWithChildren, ReactNode } from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';

type SectionCardProps = PropsWithChildren<
  Omit<CardProps, 'title' | 'actions'> & {
    title?: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
  }
>;

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  ...rest
}: SectionCardProps) {
  return (
    <Card
      {...rest}
      className={['section-card', className].filter(Boolean).join(' ')}
      title={
        title || subtitle ? (
          <div className="section-card__header">
            <div className="section-card__title-wrap">
              {title ? <div className="section-card__title">{title}</div> : null}
              {subtitle ? <div className="section-card__subtitle">{subtitle}</div> : null}
            </div>
            {actions ? <div className="section-card__actions">{actions}</div> : null}
          </div>
        ) : undefined
      }
    >
      {children}
    </Card>
  );
}
