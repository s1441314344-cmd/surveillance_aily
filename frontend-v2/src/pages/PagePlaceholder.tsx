import { Card, List, Tag, Typography } from 'antd';

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
      <List
        size="small"
        dataSource={bullets}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </Card>
  );
}
