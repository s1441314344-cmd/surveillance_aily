import { Card, Space, Tag, Typography } from 'antd';

const { Paragraph, Title } = Typography;

type PagePlaceholderProps = {
  title: string;
  description: string;
  bullets: string[];
  phase?: string;
};

export function PagePlaceholder({ title, description, bullets, phase = 'Phase 1' }: PagePlaceholderProps) {
  return (
    <Card>
      <Tag color="blue">{phase}</Tag>
      <Title level={3} style={{ marginTop: 12 }}>
        {title}
      </Title>
      <Paragraph type="secondary">{description}</Paragraph>
      <Space orientation="vertical" size={8}>
        {bullets.map((item) => (
          <Paragraph key={item} style={{ marginBottom: 0 }}>
            - {item}
          </Paragraph>
        ))}
      </Space>
    </Card>
  );
}
