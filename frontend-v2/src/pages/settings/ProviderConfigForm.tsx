import { Col, Form, Input, InputNumber, Row, Select } from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { ModelProvider } from '@/shared/api/configCenter';
import { ACTIVE_STATUS_OPTIONS } from '@/shared/ui';
import type { ProviderFormValues } from '@/pages/settings/types';

type ProviderConfigFormProps = {
  provider: ModelProvider;
  form: FormInstance<ProviderFormValues>;
  onSubmit: (values: ProviderFormValues) => void;
};

const FORM_ROW_GUTTER = 16;
const PROVIDER_STATUS_OPTIONS = [...ACTIVE_STATUS_OPTIONS];

function getApiKeyLabel(provider: ModelProvider) {
  return provider.has_api_key ? `API Key (当前：${provider.api_key_masked})` : 'API Key';
}

export function ProviderConfigForm({ provider, form, onSubmit }: ProviderConfigFormProps) {
  const apiKeyLabel = getApiKeyLabel(provider);

  return (
    <Form layout="vertical" form={form} onFinish={onSubmit}>
      <Row gutter={FORM_ROW_GUTTER}>
        <Col xs={24} md={12}>
          <Form.Item label="展示名称" name="display_name" rules={[{ required: true, message: '请输入展示名称' }]}>
            <Input placeholder="例如 Google Gemini" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={PROVIDER_STATUS_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Base URL" name="base_url" rules={[{ required: true, message: '请输入接口地址' }]}>
        <Input placeholder="例如 https://api.openai.com/v1/responses" />
      </Form.Item>

      <Row gutter={FORM_ROW_GUTTER}>
        <Col xs={24} md={12}>
          <Form.Item label="默认模型" name="default_model" rules={[{ required: true, message: '请输入默认模型' }]}>
            <Input placeholder="例如 gpt-5-mini / doubao-seed-2-0-mini-260215 / gemini-2.5-flash" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="超时时间(秒)" name="timeout_seconds" rules={[{ required: true, message: '请输入超时时间' }]}>
            <InputNumber min={1} max={600} className="input-full" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label={apiKeyLabel} name="api_key">
        <Input.Password placeholder="留空则保持当前密钥不变" />
      </Form.Item>
    </Form>
  );
}
