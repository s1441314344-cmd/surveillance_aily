import { Button, Card, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <Card>
      <Space direction="vertical" size={12}>
        <Title level={4} style={{ margin: 0 }}>
          无权限访问
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          当前账号没有访问该模块所需的角色权限。请联系系统管理员分配权限，或返回可访问页面继续操作。
        </Paragraph>
        <Space>
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回总览看板
          </Button>
          <Text type="secondary">若权限刚更新，请重新登录后再试。</Text>
        </Space>
      </Space>
    </Card>
  );
}
