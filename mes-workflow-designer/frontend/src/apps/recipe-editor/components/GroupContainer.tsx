import { Card } from 'antd';

interface GroupContainerProps {
  group: any;
  children: React.ReactNode;
}

export default function GroupContainer({ group, children }: GroupContainerProps) {
  return (
    <Card
      title={group.name}
      size="small"
      style={{
        borderColor: group.color,
        backgroundColor: `${group.color}10`,
        marginBottom: 16
      }}
      headStyle={{
        backgroundColor: group.color,
        color: '#fff'
      }}
    >
      {children}
    </Card>
  );
}
