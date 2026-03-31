import { Col, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import {
  DEFAULT_TRIGGER_RULE_VALUES,
  type TriggerRuleFormValues,
  TRIGGER_EVENT_TYPE_OPTIONS,
} from './cameraCenterConfig';

type TriggerRuleModalProps = {
  open: boolean;
  isEditing: boolean;
  form: FormInstance<TriggerRuleFormValues>;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: TriggerRuleFormValues) => void | Promise<void>;
};

export function TriggerRuleModal({
  open,
  isEditing,
  form,
  loading,
  onCancel,
  onSubmit,
}: TriggerRuleModalProps) {
  return (
    <Modal
      open={open}
      title={isEditing ? '编辑触发规则' : '新增触发规则'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
      forceRender
    >
      <Form
        layout="vertical"
        form={form}
        initialValues={DEFAULT_TRIGGER_RULE_VALUES}
        onFinish={onSubmit}
      >
        <Form.Item label="规则名称" name="name" rules={[{ required: true, message: '请输入规则名称' }]}>
          <Input placeholder="例如：人员进入触发" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="事件类型" name="event_type" rules={[{ required: true, message: '请选择事件类型' }]}>
              <Select
                options={[...TRIGGER_EVENT_TYPE_OPTIONS]}
                onChange={(value) => {
                  if (value === 'custom') {
                    form.setFieldValue('event_key', '');
                  } else {
                    form.setFieldValue('event_key', value);
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="事件键(event_key)"
              name="event_key"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (getFieldValue('event_type') !== 'custom') {
                      return Promise.resolve();
                    }
                    if (typeof value === 'string' && value.trim()) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('自定义事件必须填写事件键'));
                  },
                }),
              ]}
            >
              <Input placeholder="例如：person / fire / leak / custom_event" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="置信度阈值" name="min_confidence">
              <InputNumber min={0} max={1} step={0.05} precision={2} className="input-full" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="最少连续帧" name="min_consecutive_frames">
              <InputNumber min={1} max={300} className="input-full" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="冷却时间(秒)" name="cooldown_seconds">
              <InputNumber min={0} max={86400} className="input-full" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="规则描述" name="description">
          <Input.TextArea placeholder="可选，用于说明适用场景" autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>

        <Form.Item label="启用状态" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

