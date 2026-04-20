import { Alert, Button, Col, Form, Input, Row, Select, Switch } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { FilterToolbar, RESULT_FORMAT_DEBUG_OPTIONS } from '@/shared/ui';
import type { ModelProvider } from '@/shared/api/modelProviders';
import type { DebugFormValues } from '@/pages/settings/types';

type ProviderDebugFormProps = {
  provider: ModelProvider;
  form: FormInstance<DebugFormValues>;
  loading: boolean;
  onSubmit: () => void;
};

const FORM_ROW_GUTTER = 16;
const DEBUG_RESPONSE_FORMAT_OPTIONS = RESULT_FORMAT_DEBUG_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}));

function getDebugModelPlaceholder(provider: ModelProvider) {
  return provider.provider === 'ark'
    ? '方舟建议填 endpoint id（例如 ep-202603280001）'
    : '留空则使用默认模型';
}

export function ProviderDebugForm({
  provider,
  form,
  loading,
  onSubmit,
}: ProviderDebugFormProps) {
  return (
    <FilterToolbar
      title="调试参数"
      description="可切换结果格式、提示词和是否附带示例图片"
      actions={(
        <Button type="primary" onClick={onSubmit} loading={loading}>
          执行调试
        </Button>
      )}
    >
      <Form layout="vertical" form={form} className="stack-full">
        {provider.provider === 'ark' ? (
          <Alert
            type="warning"
            showIcon
            title="方舟调试建议"
            description="若包含图片输入，请优先使用支持视觉的 endpoint 模型（通常为 ep- 开头）。普通文本模型附带示例图片可能返回 400。"
          />
        ) : null}
        <Row gutter={FORM_ROW_GUTTER}>
          <Col xs={24} md={12}>
            <Form.Item label="调试模型" name="model">
              <Input placeholder={getDebugModelPlaceholder(provider)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="结果格式" name="response_format">
              <Select options={DEBUG_RESPONSE_FORMAT_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="调试提示词" name="prompt" rules={[{ required: true, message: '请输入调试提示词' }]}>
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, next) => prev.response_format !== next.response_format}>
          {({ getFieldValue }) =>
            getFieldValue('response_format') === 'json_schema' ? (
              <Form.Item label="调试 Schema(JSON)" name="response_schema" rules={[{ required: true, message: '请输入调试 Schema' }]}>
                <Input.TextArea autoSize={{ minRows: 6, maxRows: 12 }} />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item
          label="附带示例图片"
          name="include_sample_image"
          valuePropName="checked"
          className="form-item-no-margin"
        >
          <Switch />
        </Form.Item>
      </Form>
    </FilterToolbar>
  );
}
