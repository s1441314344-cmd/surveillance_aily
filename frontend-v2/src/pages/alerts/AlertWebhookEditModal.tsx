import { Form, Input, Modal, Switch } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { type WebhookFormValues } from '@/pages/alerts/types';

type AlertWebhookEditModalProps = {
  form: FormInstance<WebhookFormValues>;
  open: boolean;
  confirmLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: WebhookFormValues) => void;
};

export function AlertWebhookEditModal({
  form,
  open,
  confirmLoading,
  onCancel,
  onSubmit,
}: AlertWebhookEditModalProps) {
  return (
    <Modal
      title="编辑 Webhook"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={confirmLoading}
    >
      <Form<WebhookFormValues> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="推送地址" name="endpoint" rules={[{ required: true, message: '请输入推送地址' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="订阅事件（逗号分隔）"
          name="events"
          rules={[{ required: true, message: '请输入订阅事件' }]}
        >
          <Input placeholder="例如 alert.created,alert.updated" />
        </Form.Item>
        <Form.Item label="签名密钥（可选，留空不更新）" name="secret">
          <Input.Password placeholder="留空时保持原有密钥不变" />
        </Form.Item>
        <Form.Item label="启用" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
