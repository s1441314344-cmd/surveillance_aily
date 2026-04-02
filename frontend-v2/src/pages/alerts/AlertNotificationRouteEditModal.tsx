import { Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { FeishuRecipientSelect } from '@/pages/alerts/FeishuRecipientSelect';
import type { NotificationRouteFormValues } from '@/pages/alerts/types';

type AlertNotificationRouteEditModalProps = {
  form: FormInstance<NotificationRouteFormValues>;
  open: boolean;
  confirmLoading: boolean;
  strategyOptions: Array<{ label: string; value: string }>;
  onCancel: () => void;
  onSubmit: (values: NotificationRouteFormValues) => void;
};

const SEVERITY_OPTIONS = [
  { label: '严重', value: 'critical' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
];

const RECIPIENT_TYPE_OPTIONS = [
  { label: '人员(user)', value: 'user' },
  { label: '群组(chat)', value: 'chat' },
];

export function AlertNotificationRouteEditModal({
  form,
  open,
  confirmLoading,
  strategyOptions,
  onCancel,
  onSubmit,
}: AlertNotificationRouteEditModalProps) {
  const recipientType = Form.useWatch('recipient_type', form) ?? 'chat';

  return (
    <Modal
      title="编辑通知路由"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={confirmLoading}
    >
      <Form<NotificationRouteFormValues> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label="路由名称" name="name" rules={[{ required: true, message: '请输入路由名称' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="策略（可选）" name="strategy_id">
          <Select allowClear showSearch options={strategyOptions} placeholder="不选=匹配全部策略" />
        </Form.Item>

        <Form.Item label="事件键（可选）" name="event_key">
          <Input placeholder="例如：fire / person / leak，不填=全部事件" />
        </Form.Item>

        <Form.Item label="级别（可选）" name="severity">
          <Select allowClear options={SEVERITY_OPTIONS} placeholder="不选=全部级别" />
        </Form.Item>

        <Form.Item label="摄像头 ID（可选）" name="camera_id">
          <Input placeholder="不填=全部摄像头" />
        </Form.Item>

        <Form.Item label="接收对象类型" name="recipient_type" rules={[{ required: true, message: '请选择接收对象类型' }]}>
          <Select
            options={RECIPIENT_TYPE_OPTIONS}
            onChange={() => form.setFieldValue('recipient_id', undefined)}
          />
        </Form.Item>

        <Form.Item
          label="接收对象"
          name="recipient_id"
          rules={[{ required: true, message: '请选择接收对象' }]}
        >
          <FeishuRecipientSelect recipientType={recipientType} />
        </Form.Item>

        <Form.Item label="优先级（越小越优先）" name="priority">
          <InputNumber min={0} max={100000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="冷却秒数" name="cooldown_seconds">
          <InputNumber min={0} max={86400} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="消息模板（可选）" name="message_template">
          <Input.TextArea
            rows={4}
            placeholder="支持变量：{event_key} {severity} {camera_name} {camera_id} {strategy_name} {confidence} {occurred_at} {message} {alert_id}"
          />
        </Form.Item>

        <Form.Item label="启用" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
