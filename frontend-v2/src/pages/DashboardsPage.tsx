import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  createDashboardDefinition,
  DashboardDefinition,
  deleteDashboardDefinition,
  listDashboardDefinitions,
  updateDashboardDefinition,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;
const CREATE_DASHBOARD_ID = '__create_dashboard__';

type DashboardFormValues = {
  name: string;
  description?: string;
  definition_text: string;
  status: string;
  is_default: boolean;
};

const DEFAULT_DEFINITION_TEXT = JSON.stringify(
  {
    widgets: [
      { type: 'kpi', metric: 'success_rate' },
      { type: 'line', metric: 'jobs_trend' },
      { type: 'table', metric: 'anomalies' },
    ],
    filters: {
      strategy_id: null,
      model_provider: null,
      time_range: '7d',
    },
  },
  null,
  2,
);

export function DashboardsPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<DashboardFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-definitions', statusFilter],
    queryFn: () =>
      listDashboardDefinitions({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const dashboards = useMemo(() => dashboardQuery.data ?? [], [dashboardQuery.data]);
  const effectiveSelectedDashboardId = useMemo(() => {
    if (selectedDashboardId === CREATE_DASHBOARD_ID) {
      return null;
    }

    const exists = selectedDashboardId && dashboards.some((item) => item.id === selectedDashboardId);
    return exists ? selectedDashboardId : dashboards[0]?.id ?? null;
  }, [dashboards, selectedDashboardId]);
  const activeDashboard = useMemo(
    () => dashboards.find((item) => item.id === effectiveSelectedDashboardId) ?? null,
    [dashboards, effectiveSelectedDashboardId],
  );

  useEffect(() => {
    if (!activeDashboard) {
      return;
    }
    form.setFieldsValue({
      name: activeDashboard.name,
      description: activeDashboard.description ?? '',
      definition_text: JSON.stringify(activeDashboard.definition ?? {}, null, 2),
      status: activeDashboard.status,
      is_default: activeDashboard.is_default,
    });
  }, [activeDashboard, form]);

  const invalidateDashboardQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard-definitions'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-definitions', statusFilter] }),
    ]);

  const createMutation = useMutation({
    mutationFn: createDashboardDefinition,
    onSuccess: async (dashboard) => {
      await invalidateDashboardQueries();
      setSelectedDashboardId(dashboard.id);
      message.success('看板定义创建成功');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '看板定义创建失败'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      dashboardId,
      payload,
    }: {
      dashboardId: string;
      payload: Parameters<typeof updateDashboardDefinition>[1];
    }) => updateDashboardDefinition(dashboardId, payload),
    onSuccess: async () => {
      await invalidateDashboardQueries();
      message.success('看板定义已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '看板定义更新失败'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDashboardDefinition,
    onSuccess: async () => {
      await invalidateDashboardQueries();
      setSelectedDashboardId(null);
      resetForCreate();
      message.success('看板定义已删除');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '看板定义删除失败'));
    },
  });

  const resetForCreate = () => {
    setSelectedDashboardId(CREATE_DASHBOARD_ID);
    form.setFieldsValue({
      name: '',
      description: '',
      definition_text: DEFAULT_DEFINITION_TEXT,
      status: 'active',
      is_default: false,
    });
  };

  useEffect(() => {
    if (!activeDashboard && dashboards.length === 0) {
      resetForCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDashboard, dashboards.length]);

  const handleSubmit = async (values: DashboardFormValues) => {
    let definition: Record<string, unknown>;
    try {
      definition = JSON.parse(values.definition_text);
    } catch {
      message.error('看板定义 JSON 不是合法格式');
      return;
    }

    const payload = {
      name: values.name,
      description: values.description?.trim() || null,
      definition,
      status: values.status,
      is_default: values.is_default,
    };

    if (effectiveSelectedDashboardId) {
      await updateMutation.mutateAsync({
        dashboardId: effectiveSelectedDashboardId,
        payload,
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const handleDelete = () => {
    if (!effectiveSelectedDashboardId) {
      return;
    }
    modal.confirm({
      title: '删除看板定义',
      content: '删除后不可恢复，是否继续？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteMutation.mutateAsync(effectiveSelectedDashboardId);
      },
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          看板配置
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          管理可复用的看板定义（布局 JSON + 指标组合）。后续拖拽式看板会在此基础上扩展。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={8}>
          <Card
            title="看板定义列表"
            extra={
              <Space>
                <Select
                  size="small"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { label: '全部状态', value: 'all' },
                    { label: '启用', value: 'active' },
                    { label: '停用', value: 'inactive' },
                  ]}
                  style={{ width: 110 }}
                />
                <Button size="small" type="primary" onClick={resetForCreate}>
                  新建
                </Button>
              </Space>
            }
          >
            {dashboardQuery.isLoading ? (
              <Spin />
            ) : dashboards.length ? (
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {dashboards.map((item: DashboardDefinition) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    style={{
                      cursor: 'pointer',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid #f0f0f0',
                      background: item.id === effectiveSelectedDashboardId ? '#f0f7ff' : '#fff',
                    }}
                    onClick={() => setSelectedDashboardId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDashboardId(item.id);
                      }
                    }}
                  >
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{item.name}</Text>
                        <Tag color={item.status === 'active' ? 'green' : 'default'}>{item.status}</Tag>
                        {item.is_default ? <Tag color="blue">默认</Tag> : null}
                      </Space>
                      <Text type="secondary">{item.description || '无描述'}</Text>
                    </Space>
                  </div>
                ))}
              </Space>
            ) : (
              <Empty description="当前筛选条件下暂无看板定义" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={effectiveSelectedDashboardId ? '编辑看板定义' : '新建看板定义'}>
            <Form layout="vertical" form={form} onFinish={handleSubmit}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="看板名称" name="name" rules={[{ required: true, message: '请输入看板名称' }]}>
                    <Input placeholder="例如：巡检总览看板" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
                    <Select
                      options={[
                        { label: '启用', value: 'active' },
                        { label: '停用', value: 'inactive' },
                      ]}
                    />
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

              <Space>
                <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
                  {effectiveSelectedDashboardId ? '保存修改' : '创建看板'}
                </Button>
                <Button onClick={resetForCreate}>重置为新建</Button>
                {effectiveSelectedDashboardId ? (
                  <Button danger onClick={handleDelete} loading={deleteMutation.isPending}>
                    删除看板
                  </Button>
                ) : null}
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
