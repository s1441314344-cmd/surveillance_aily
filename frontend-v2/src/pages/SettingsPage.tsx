import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Empty, Form, Input, List, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { listModelProviders, ModelProvider, updateModelProvider } from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const { Paragraph, Text, Title } = Typography;

type ProviderFormValues = {
  display_name: string;
  base_url: string;
  api_key?: string;
  default_model: string;
  timeout_seconds: number;
  status: string;
};

export function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<ProviderFormValues>();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const providerQuery = useQuery({
    queryKey: ['model-providers'],
    queryFn: listModelProviders,
  });

  const providers = providerQuery.data ?? [];
  const activeProvider = useMemo(
    () => providers.find((item) => item.provider === selectedProvider) ?? null,
    [providers, selectedProvider],
  );

  useEffect(() => {
    if (!providers.length) {
      return;
    }

    const exists = providers.some((item) => item.provider === selectedProvider);
    const nextProvider = exists ? selectedProvider : providers[0]?.provider;
    if (nextProvider && nextProvider !== selectedProvider) {
      setSelectedProvider(nextProvider);
    }
  }, [providers, selectedProvider]);

  useEffect(() => {
    if (!activeProvider) {
      return;
    }

    form.setFieldsValue({
      display_name: activeProvider.display_name,
      base_url: activeProvider.base_url,
      api_key: '',
      default_model: activeProvider.default_model,
      timeout_seconds: activeProvider.timeout_seconds,
      status: activeProvider.status,
    });
  }, [activeProvider, form]);

  const saveMutation = useMutation({
    mutationFn: ({ provider, payload }: { provider: string; payload: ProviderFormValues }) =>
      updateModelProvider(provider, {
        display_name: payload.display_name,
        base_url: payload.base_url,
        api_key: payload.api_key?.trim() || undefined,
        default_model: payload.default_model,
        timeout_seconds: Number(payload.timeout_seconds),
        status: payload.status,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['model-providers'] });
      message.success(`${variables.provider.toUpperCase()} 配置已保存`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '模型提供方保存失败'));
    },
  });

  const handleSubmit = async (values: ProviderFormValues) => {
    if (!selectedProvider) {
      message.warning('请先选择一个模型提供方');
      return;
    }

    await saveMutation.mutateAsync({ provider: selectedProvider, payload: values });
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          模型与系统设置
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          管理 OpenAI / 智谱 等模型提供方，统一维护模型入口、默认模型、超时和密钥状态。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={8}>
          <Card title="提供方列表" style={{ height: '100%' }}>
            {providerQuery.isLoading ? (
              <Spin />
            ) : providers.length ? (
              <List
                dataSource={providers}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      paddingInline: 12,
                      borderRadius: 12,
                      background: item.provider === selectedProvider ? '#f0f7ff' : 'transparent',
                    }}
                    onClick={() => setSelectedProvider(item.provider)}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{item.display_name}</Text>
                        <Tag color={item.status === 'active' ? 'green' : 'default'}>{item.status}</Tag>
                      </Space>
                      <Text type="secondary">{item.default_model}</Text>
                      <Text type="secondary">{item.api_key_masked || '尚未配置 API Key'}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无模型提供方" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title="提供方配置">
            {activeProvider ? (
              <Form layout="vertical" form={form} onFinish={handleSubmit}>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="展示名称" name="display_name" rules={[{ required: true, message: '请输入展示名称' }]}>
                      <Input placeholder="例如 OpenAI" />
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

                <Form.Item label="Base URL" name="base_url" rules={[{ required: true, message: '请输入接口地址' }]}>
                  <Input placeholder="https://api.openai.com/v1/responses" />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="默认模型" name="default_model" rules={[{ required: true, message: '请输入默认模型' }]}>
                      <Input placeholder="例如 gpt-5-mini" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="超时时间(秒)" name="timeout_seconds" rules={[{ required: true, message: '请输入超时时间' }]}>
                      <Input type="number" min={1} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label={`API Key ${activeProvider.has_api_key ? `(当前：${activeProvider.api_key_masked})` : ''}`}
                  name="api_key"
                >
                  <Input.Password placeholder="留空则保持当前密钥不变" />
                </Form.Item>

                <Space>
                  <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                    保存配置
                  </Button>
                  <Tag color={activeProvider.has_api_key ? 'green' : 'orange'}>
                    {activeProvider.has_api_key ? '已配置密钥' : '未配置密钥'}
                  </Tag>
                </Space>
              </Form>
            ) : (
              <Empty description="请选择一个模型提供方" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
