import { Button, Form, Input, Switch } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { type WebhookFormValues } from '@/pages/alerts/types';

type AlertWebhookCreateFormProps = {
  form: FormInstance<WebhookFormValues>;
  submitLoading: boolean;
  onSubmit: (values: WebhookFormValues) => void;
};

export function AlertWebhookCreateForm({
  form,
  submitLoading,
  onSubmit,
}: AlertWebhookCreateFormProps) {
  return (
    <Form<WebhookFormValues>
      layout="vertical"
      form={form}
      onFinish={onSubmit}
      initialValues={{ enabled: true, events: 'alert.created,alert.updated' }}
    >
      <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
        <Input />
      </Form.Item>
      <Form.Item label="推送地址" name="endpoint" rules={[{ required: true, message: '请输入推送地址' }]}>
        <Input placeholder="https://example.com/webhook" />
      </Form.Item>
      <Form.Item
        label="订阅事件（逗号分隔）"
        name="events"
        rules={[{ required: true, message: '请输入订阅事件' }]}
      >
        <Input placeholder="例如 alert.created,alert.updated" />
      </Form.Item>
      <Form.Item label="签名密钥（可选）" name="secret">
        <Input.Password placeholder="可选，用于生成签名并做回调验签" />
      </Form.Item>
      <Form.Item label="启用" name="enabled" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={submitLoading}>
        新增 Webhook
      </Button>
    </Form>
  );
}
