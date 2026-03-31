import { Typography } from 'antd';

const { Paragraph, Text } = Typography;

type CameraPaneHeaderProps = {
  title: string;
  description: string;
};

export function CameraPaneHeader({ title, description }: CameraPaneHeaderProps) {
  return (
    <div className="page-stack-tight">
      <Text strong>{title}</Text>
      <Paragraph type="secondary" className="page-paragraph-reset">
        {description}
      </Paragraph>
    </div>
  );
}
