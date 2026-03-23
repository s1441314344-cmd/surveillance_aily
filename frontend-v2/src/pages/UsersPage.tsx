import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createUser, listUsers, updateUserStatus, type User } from '@/shared/api/users';
import { getApiErrorMessage } from '@/shared/api/errors';
import { useAuthStore } from '@/shared/state/authStore';

const { Paragraph, Text, Title } = Typography;

type CreateUserFormValues = {
  username: string;
  display_name: string;
  password: string;
  roles: string[];
};

const roleOptions = [
  { value: 'system_admin', label: '系统管理员', color: 'red' },
  { value: 'strategy_configurator', label: '策略配置员', color: 'blue' },
  { value: 'task_operator', label: '任务操作员', color: 'cyan' },
  { value: 'manual_reviewer', label: '人工复核员', color: 'gold' },
  { value: 'analysis_viewer', label: '分析查看者', color: 'green' },
];

const roleLabelMap = Object.fromEntries(roleOptions.map((item) => [item.value, item.label]));
const roleColorMap = Object.fromEntries(roleOptions.map((item) => [item.value, item.color]));

function renderRoleTag(roleCode: string) {
  return (
    <Tag key={roleCode} color={roleColorMap[roleCode] ?? 'default'}>
      {roleLabelMap[roleCode] ?? roleCode}
    </Tag>
  );
}

export function UsersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CreateUserFormValues>();
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const canManageUsers = currentUser?.roles.includes('system_admin') ?? false;

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    enabled: canManageUsers,
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const userStats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((item) => item.is_active).length,
      inactive: users.filter((item) => !item.is_active).length,
      admins: users.filter((item) => item.roles.includes('system_admin')).length,
    }),
    [users],
  );

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (createdUser) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      form.resetFields();
      message.success(`用户 ${createdUser.display_name} 已创建`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '创建用户失败'));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => updateUserStatus(userId, isActive),
    onSuccess: (updatedUser) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      message.success(`${updatedUser.display_name} 已${updatedUser.is_active ? '启用' : '停用'}`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '更新用户状态失败'));
    },
    onSettled: () => {
      setTogglingUserId(null);
    },
  });

  const columns: ColumnsType<User> = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.display_name}</Text>
          <Text type="secondary">{record.username}</Text>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (roles: string[]) =>
        roles.length ? <Space size={[0, 8]} wrap>{roles.map(renderRoleTag)}</Space> : <Text type="secondary">未分配</Text>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 120,
      render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用中' : '已停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => {
        const disabled = record.id === currentUser?.id;
        return (
          <Button
            size="small"
            disabled={disabled}
            loading={togglingUserId === record.id}
            onClick={() => {
              setTogglingUserId(record.id);
              statusMutation.mutate({ userId: record.id, isActive: !record.is_active });
            }}
          >
            {disabled ? '当前账号' : record.is_active ? '停用' : '启用'}
          </Button>
        );
      },
    },
  ];

  const handleCreateUser = async (values: CreateUserFormValues) => {
    await createMutation.mutateAsync({
      username: values.username.trim(),
      display_name: values.display_name.trim(),
      password: values.password,
      roles: values.roles,
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          用户与权限
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          管理系统用户、角色分配和启停状态，当前页面覆盖 V1 最小 RBAC 运维闭环。
        </Paragraph>
      </div>

      {!canManageUsers ? (
        <Alert
          type="warning"
          showIcon
          title="当前账号不是系统管理员"
          description="你可以查看系统其它模块，但用户与权限管理仅对 system_admin 开放。"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="用户总数" value={userStats.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="启用用户" value={userStats.active} styles={{ content: { color: '#389e0d' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="停用用户" value={userStats.inactive} styles={{ content: { color: '#8c8c8c' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="管理员数量" value={userStats.admins} styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} align="stretch">
        <Col xs={24} xl={15}>
          <Card title="用户列表">
            {!canManageUsers ? (
              <Empty description="当前账号无权读取用户列表" />
            ) : (
              <Table<User>
                rowKey="id"
                loading={usersQuery.isLoading}
                dataSource={users}
                columns={columns}
                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                locale={{ emptyText: usersQuery.isError ? '用户列表加载失败' : '暂无用户' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title="新增用户">
            <Form<CreateUserFormValues>
              layout="vertical"
              form={form}
              onFinish={handleCreateUser}
              initialValues={{ roles: ['analysis_viewer'] }}
              disabled={!canManageUsers}
            >
              <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="例如 inspector_01" autoComplete="off" />
              </Form.Item>

              <Form.Item label="显示名称" name="display_name" rules={[{ required: true, message: '请输入显示名称' }]}>
                <Input placeholder="例如 巡检操作员-东区" autoComplete="off" />
              </Form.Item>

              <Form.Item label="初始密码" name="password" rules={[{ required: true, message: '请输入初始密码' }, { min: 8, message: '密码至少 8 位' }]}>
                <Input.Password placeholder="请设置至少 8 位密码" autoComplete="new-password" />
              </Form.Item>

              <Form.Item label="角色分配" name="roles" rules={[{ required: true, message: '请至少选择一个角色' }]}>
                <Select
                  mode="multiple"
                  options={roleOptions.map((item) => ({ label: item.label, value: item.value }))}
                  placeholder="请选择角色"
                />
              </Form.Item>

              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  title="角色建议"
                  description="普通查看账号建议默认使用“分析查看者”；只有负责配置或运维的人再额外分配管理角色。"
                />
                <Button type="primary" htmlType="submit" block loading={createMutation.isPending}>
                  创建用户
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
