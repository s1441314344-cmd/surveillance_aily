import { useMutation } from '@tanstack/react-query';
import { Alert, App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { login } from '@/shared/api/auth';
import { getApiErrorMessage } from '@/shared/api/errors';
import { useAuthStore } from '@/shared/state/authStore';

const { Paragraph, Title } = Typography;

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [form] = Form.useForm<{ username: string; password: string }>();

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      setSession({
        token: response.access_token,
        refreshToken: response.refresh_token,
        user: {
          id: response.user.id,
          username: response.user.username,
          displayName: response.user.display_name,
          roles: response.user.roles,
        },
      });
      message.success('登录成功');
      navigate('/dashboard');
    },
  });

  const handleFinish = async (values: { username: string; password: string }) => {
    try {
      await loginMutation.mutateAsync(values);
    } catch (error) {
      message.error(getApiErrorMessage(error, '登录失败'));
    }
  };

  return (
    <div className="login-shell">
      <Card className="login-card">
        <Space orientation="vertical" size={16}>
          <Title level={2} style={{ marginBottom: 0 }}>
            智能巡检系统 V2
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            已接入 V2 后端认证。默认开发账号为 `admin / admin123456`，可直接进入配置中心联调。
          </Paragraph>
          <Alert
            type="info"
            showIcon
            title="默认账号"
            description="用户名：admin，密码：admin123456"
          />
          <Form
            layout="vertical"
            form={form}
            initialValues={{ username: 'admin', password: 'admin123456' }}
            onFinish={handleFinish}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input size="large" placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" placeholder="请输入密码" />
            </Form.Item>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              block
              loading={loginMutation.isPending}
            >
              登录系统
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
