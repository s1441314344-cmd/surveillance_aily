import type { ReactNode } from 'react';
import { Space, Typography } from 'antd';

const { Paragraph, Text, Title } = Typography;

export type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  extra,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <Text className="page-header__eyebrow">{eyebrow}</Text> : null}
        <Title level={2} className="page-header__title">
          {title}
        </Title>
        {description ? (
          <Paragraph className="page-header__description" type="secondary">
            {description}
          </Paragraph>
        ) : null}
      </div>
      {extra ? <Space className="page-header__actions">{extra}</Space> : null}
    </div>
  );
}
