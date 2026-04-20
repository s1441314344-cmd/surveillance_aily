import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useLoginPageController } from '@/pages/login/useLoginPageController';
import { RoutePageHeader } from '@/shared/ui';

const { Paragraph } = Typography;

export function LoginPage() {
  const { form, loginMutation, handleFinish } = useLoginPageController();

  return (
    <div className="login-shell">
      <Card className="login-card">
        <Space orientation="vertical" size={20} className="login-card__stack">
          <RoutePageHeader description="统一管理巡检任务、摄像头、模型配置与告警分析。默认开发账号可直接进入配置中心联调。" />
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
              <Input size="large" placeholder="请输入用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" placeholder="请输入密码" autoComplete="current-password" />
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
          <Paragraph type="secondary" className="login-card__hint">
            登录后可继续访问任务中心、摄像头中心、模型与系统设置等页面。
          </Paragraph>
        </Space>
      </Card>
    </div>
  );
}
