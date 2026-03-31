import { Button, Col, Form, Input, Row, Select, Space, Switch } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ACTIVE_STATUS_OPTIONS } from '@/shared/ui';
import { type DashboardFormValues } from '@/pages/dashboards/types';

const { TextArea } = Input;

type DashboardDefinitionFormProps = {
  form: FormInstance<DashboardFormValues>;
  selectedDashboardId: string | null;
  submitLoading: boolean;
  validateLoading: boolean;
  deleteLoading: boolean;
  onSubmit: (values: DashboardFormValues) => void;
  onValidate: () => void;
  onReset: () => void;
  onDelete: () => void;
};

export function DashboardDefinitionForm({
  form,
  selectedDashboardId,
  submitLoading,
  validateLoading,
  deleteLoading,
  onSubmit,
  onValidate,
  onReset,
  onDelete,
}: DashboardDefinitionFormProps) {
  return (
    <Form layout="vertical" form={form} onFinish={onSubmit}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="看板名称" name="name" rules={[{ required: true, message: '请输入看板名称' }]}>
            <Input placeholder="例如：巡检总览看板" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[...ACTIVE_STATUS_OPTIONS]} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="描述" name="description">
        <Input placeholder="说明该看板适用场景" />
      </Form.Item>

      <Form.Item
        label="设为默认看板"
        name="is_default"
        valuePropName="checked"
        tooltip="设为默认后会自动取消其他默认看板"
      >
        <Switch />
      </Form.Item>

      <Form.Item
        label="看板定义 JSON"
        name="definition_text"
        rules={[{ required: true, message: '请输入看板定义 JSON' }]}
      >
        <TextArea rows={14} spellCheck={false} />
      </Form.Item>

      <Space wrap>
        <Button type="primary" htmlType="submit" loading={submitLoading}>
          {selectedDashboardId ? '保存修改' : '创建看板'}
        </Button>
        <Button onClick={onValidate} loading={validateLoading}>
          服务端校验
        </Button>
        <Button onClick={onReset}>重置为新建</Button>
        {selectedDashboardId ? (
          <Button danger onClick={onDelete} loading={deleteLoading}>
            删除看板
          </Button>
        ) : null}
      </Space>
    </Form>
  );
}
