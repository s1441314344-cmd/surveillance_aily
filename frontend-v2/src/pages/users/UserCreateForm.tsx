import { Button, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { roleOptions, type CreateUserFormValues } from '@/pages/users/types';

type UserCreateFormProps = {
  form: FormInstance<CreateUserFormValues>;
  loading: boolean;
  onSubmit: (values: CreateUserFormValues) => void;
};

export function UserCreateForm({ form, loading, onSubmit }: UserCreateFormProps) {
  return (
    <Form<CreateUserFormValues>
      layout="vertical"
      form={form}
      onFinish={onSubmit}
      initialValues={{ roles: ['analysis_viewer'] }}
    >
      <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input placeholder="例如 inspector_01" autoComplete="off" />
      </Form.Item>

      <Form.Item label="显示名称" name="display_name" rules={[{ required: true, message: '请输入显示名称' }]}>
        <Input placeholder="例如 巡检操作员-东区" autoComplete="off" />
      </Form.Item>

      <Form.Item
        label="初始密码"
        name="password"
        rules={[{ required: true, message: '请输入初始密码' }, { min: 8, message: '密码至少 8 位' }]}
      >
        <Input.Password placeholder="请设置至少 8 位密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item label="角色分配" name="roles" rules={[{ required: true, message: '请至少选择一个角色' }]}>
        <Select
          mode="multiple"
          options={roleOptions.map((item) => ({ label: item.label, value: item.value }))}
          placeholder="请选择角色"
        />
      </Form.Item>

      <Button type="primary" htmlType="submit" block loading={loading}>
        创建用户
      </Button>
    </Form>
  );
}
