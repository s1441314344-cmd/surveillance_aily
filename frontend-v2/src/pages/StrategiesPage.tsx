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
  List,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  createStrategy,
  listModelProviders,
  listStrategies,
  Strategy,
  updateStrategy,
  updateStrategyStatus,
  validateStrategySchema,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type StrategyFormValues = {
  name: string;
  scene_description: string;
  prompt_template: string;
  model_provider: string;
  model_name: string;
  response_schema_text: string;
  status: string;
};

const DEFAULT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      has_issue: { type: 'boolean' },
    },
    required: ['summary', 'has_issue'],
  },
  null,
  2,
);

export function StrategiesPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<StrategyFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  const providerQuery = useQuery({
    queryKey: ['model-providers'],
    queryFn: listModelProviders,
  });

  const strategyQuery = useQuery({
    queryKey: ['strategies', statusFilter],
    queryFn: () =>
      listStrategies({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const strategies = strategyQuery.data ?? [];
  const activeStrategy = useMemo(
    () => strategies.find((item) => item.id === selectedStrategyId) ?? null,
    [strategies, selectedStrategyId],
  );

  useEffect(() => {
    if (!strategies.length) {
      setSelectedStrategyId(null);
      return;
    }

    const exists = strategies.some((item) => item.id === selectedStrategyId);
    if (!exists) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [strategies, selectedStrategyId]);

  useEffect(() => {
    if (!activeStrategy) {
      return;
    }

    form.setFieldsValue({
      name: activeStrategy.name,
      scene_description: activeStrategy.scene_description,
      prompt_template: activeStrategy.prompt_template,
      model_provider: activeStrategy.model_provider,
      model_name: activeStrategy.model_name,
      response_schema_text: JSON.stringify(activeStrategy.response_schema, null, 2),
      status: activeStrategy.status,
    });
  }, [activeStrategy, form]);

  const invalidateStrategyQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['strategies'] }),
      queryClient.invalidateQueries({ queryKey: ['strategies', statusFilter] }),
    ]);

  const createMutation = useMutation({
    mutationFn: createStrategy,
    onSuccess: async (strategy) => {
      await invalidateStrategyQueries();
      setSelectedStrategyId(strategy.id);
      message.success('策略创建成功');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '策略创建失败'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ strategyId, payload }: { strategyId: string; payload: Parameters<typeof updateStrategy>[1] }) =>
      updateStrategy(strategyId, payload),
    onSuccess: async () => {
      await invalidateStrategyQueries();
      message.success('策略已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '策略更新失败'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ strategyId, status }: { strategyId: string; status: string }) =>
      updateStrategyStatus(strategyId, status),
    onSuccess: async () => {
      await invalidateStrategyQueries();
      message.success('策略状态已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '策略状态更新失败'));
    },
  });

  const validateMutation = useMutation({
    mutationFn: ({ strategyId, schema }: { strategyId: string; schema: Record<string, unknown> }) =>
      validateStrategySchema(strategyId, schema),
    onSuccess: (result) => {
      if (result.valid) {
        message.success('Schema 校验通过');
      } else {
        modal.error({
          title: 'Schema 校验失败',
          content: (
            <ul style={{ marginBottom: 0, paddingLeft: 18 }}>
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ),
        });
      }
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Schema 校验失败'));
    },
  });

  const resetForCreate = () => {
    setSelectedStrategyId(null);
    form.setFieldsValue({
      name: '',
      scene_description: '',
      prompt_template: '',
      model_provider: providerQuery.data?.[0]?.provider ?? 'zhipu',
      model_name: providerQuery.data?.[0]?.default_model ?? 'glm-4v-plus',
      response_schema_text: DEFAULT_SCHEMA,
      status: 'active',
    });
  };

  useEffect(() => {
    if (!activeStrategy && providerQuery.data?.length) {
      resetForCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerQuery.data?.length, activeStrategy]);

  const handleSubmit = async (values: StrategyFormValues) => {
    let responseSchema: Record<string, unknown>;

    try {
      responseSchema = JSON.parse(values.response_schema_text);
    } catch {
      message.error('JSON Schema 不是合法 JSON');
      return;
    }

    const payload = {
      name: values.name,
      scene_description: values.scene_description,
      prompt_template: values.prompt_template,
      model_provider: values.model_provider,
      model_name: values.model_name,
      response_schema: responseSchema,
      status: values.status,
    };

    if (selectedStrategyId) {
      await updateMutation.mutateAsync({ strategyId: selectedStrategyId, payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const handleValidate = async () => {
    if (!selectedStrategyId) {
      message.info('请先保存策略，再执行服务端 Schema 校验');
      return;
    }

    try {
      const raw = form.getFieldValue('response_schema_text') ?? '{}';
      const schema = JSON.parse(raw);
      await validateMutation.mutateAsync({ strategyId: selectedStrategyId, schema });
    } catch {
      message.error('JSON Schema 不是合法 JSON');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          策略中心
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          统一管理场景描述、提示词模板、目标模型与 JSON Schema，后续任务提报会直接复用这里的策略定义。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={8}>
          <Card
            title="策略列表"
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
            {strategyQuery.isLoading ? (
              <Spin />
            ) : strategies.length ? (
              <List
                dataSource={strategies}
                renderItem={(item: Strategy) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      paddingInline: 12,
                      borderRadius: 12,
                      background: item.id === selectedStrategyId ? '#f0f7ff' : 'transparent',
                    }}
                    onClick={() => setSelectedStrategyId(item.id)}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{item.name}</Text>
                        {item.is_preset ? <Tag color="purple">预设</Tag> : null}
                        <Tag color={item.status === 'active' ? 'green' : 'default'}>{item.status}</Tag>
                      </Space>
                      <Text type="secondary">{item.model_provider} / {item.model_name}</Text>
                      <Text type="secondary">版本 v{item.version}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="当前筛选条件下暂无策略" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={selectedStrategyId ? '编辑策略' : '新建策略'}
            extra={
              activeStrategy ? (
                <Space>
                  <Tag color={activeStrategy.status === 'active' ? 'green' : 'default'}>
                    {activeStrategy.status}
                  </Tag>
                  <Button
                    size="small"
                    onClick={() =>
                      updateStatusMutation.mutate({
                        strategyId: activeStrategy.id,
                        status: activeStrategy.status === 'active' ? 'inactive' : 'active',
                      })
                    }
                    loading={updateStatusMutation.isPending}
                  >
                    {activeStrategy.status === 'active' ? '停用' : '启用'}
                  </Button>
                </Space>
              ) : null
            }
          >
            <Form layout="vertical" form={form} onFinish={handleSubmit}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="策略名称" name="name" rules={[{ required: true, message: '请输入策略名称' }]}>
                    <Input placeholder="例如 安全帽识别" />
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

              <Form.Item
                label="场景描述"
                name="scene_description"
                rules={[{ required: true, message: '请输入场景描述' }]}
              >
                <TextArea rows={3} placeholder="说明该策略适用的业务场景与识别目标" />
              </Form.Item>

              <Form.Item
                label="提示词模板"
                name="prompt_template"
                rules={[{ required: true, message: '请输入提示词模板' }]}
              >
                <TextArea rows={5} placeholder="请描述需要大模型返回的结构化内容和分析重点" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="模型提供方"
                    name="model_provider"
                    rules={[{ required: true, message: '请选择模型提供方' }]}
                  >
                    <Select
                      options={(providerQuery.data ?? []).map((item) => ({
                        label: `${item.display_name} (${item.provider})`,
                        value: item.provider,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="模型名称" name="model_name" rules={[{ required: true, message: '请输入模型名称' }]}>
                    <Input placeholder="例如 gpt-5-mini / glm-4v-plus" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="JSON Schema"
                name="response_schema_text"
                rules={[{ required: true, message: '请输入 JSON Schema' }]}
              >
                <TextArea rows={12} spellCheck={false} placeholder="请输入合法 JSON Schema" />
              </Form.Item>

              <Space wrap>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {selectedStrategyId ? '保存修改' : '创建策略'}
                </Button>
                <Button onClick={handleValidate} loading={validateMutation.isPending}>
                  校验 Schema
                </Button>
                <Button onClick={resetForCreate}>清空重建</Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
