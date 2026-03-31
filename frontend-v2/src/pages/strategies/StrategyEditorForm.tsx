import { Button, Col, Form, Input, Row, Select, Space } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { ACTIVE_STATUS_OPTIONS, RESULT_FORMAT_OPTIONS } from '@/shared/ui';
import { type StrategyFormValues } from '@/pages/strategies/types';

const { TextArea } = Input;

type StrategyEditorFormProps = {
  form: FormInstance<StrategyFormValues>;
  providerOptions: Array<{ label: string; value: string }>;
  selectedStrategyId: string | null;
  submitLoading: boolean;
  validateLoading: boolean;
  onSubmit: (values: StrategyFormValues) => void;
  onValidate: () => void;
  onReset: () => void;
};

const FORM_ROW_GUTTER = 16;
const STRATEGY_STATUS_OPTIONS = [...ACTIVE_STATUS_OPTIONS];
const RESULT_FORMAT_SELECT_OPTIONS = RESULT_FORMAT_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}));

function getSchemaFieldLabel(isSchemaMode: boolean) {
  return isSchemaMode ? 'JSON Schema' : '可选 Schema（可留空）';
}

function getSchemaPlaceholder(isSchemaMode: boolean) {
  return isSchemaMode
    ? '请输入合法 JSON Schema'
    : '可选：填写用于辅助提示的 schema（留空表示不限制固定结构）';
}

function getSubmitButtonText(selectedStrategyId: string | null) {
  return selectedStrategyId ? '保存修改' : '创建策略';
}

function createSchemaValidator(isSchemaMode: boolean) {
  return (_: unknown, value: string | undefined) => {
    if (!isSchemaMode) {
      return Promise.resolve();
    }
    if (!value || !String(value).trim()) {
      return Promise.reject(new Error('JSON Schema 模式下请填写 Schema'));
    }
    return Promise.resolve();
  };
}

export function StrategyEditorForm({
  form,
  providerOptions,
  selectedStrategyId,
  submitLoading,
  validateLoading,
  onSubmit,
  onValidate,
  onReset,
}: StrategyEditorFormProps) {
  const submitButtonText = getSubmitButtonText(selectedStrategyId);

  return (
    <Form layout="vertical" form={form} onFinish={onSubmit}>
      <Row gutter={FORM_ROW_GUTTER}>
        <Col xs={24} md={12}>
          <Form.Item label="策略名称" name="name" rules={[{ required: true, message: '请输入策略名称' }]}>
            <Input placeholder="例如 安全帽识别" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STRATEGY_STATUS_OPTIONS} />
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

      <Row gutter={FORM_ROW_GUTTER}>
        <Col xs={24} md={12}>
          <Form.Item
            label="模型提供方"
            name="model_provider"
            rules={[{ required: true, message: '请选择模型提供方' }]}
          >
            <Select options={providerOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="模型名称" name="model_name" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="例如 gpt-5-mini / glm-4v-plus" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={FORM_ROW_GUTTER}>
        <Col xs={24} md={12}>
          <Form.Item
            label="输出格式"
            name="result_format"
            rules={[{ required: true, message: '请选择输出格式' }]}
          >
            <Select options={RESULT_FORMAT_SELECT_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item shouldUpdate noStyle>
        {() => {
          const resultFormat = form.getFieldValue('result_format') || 'json_schema';
          const isSchemaMode = resultFormat === 'json_schema';
          return (
            <Form.Item
              label={getSchemaFieldLabel(isSchemaMode)}
              name="response_schema_text"
              rules={[
                {
                  validator: createSchemaValidator(isSchemaMode),
                },
              ]}
            >
              <TextArea
                rows={12}
                spellCheck={false}
                placeholder={getSchemaPlaceholder(isSchemaMode)}
              />
            </Form.Item>
          );
        }}
      </Form.Item>

      <Space wrap>
        <Button type="primary" htmlType="submit" loading={submitLoading}>
          {submitButtonText}
        </Button>
        <Button onClick={onValidate} loading={validateLoading}>
          校验 Schema
        </Button>
        <Button onClick={onReset}>清空重建</Button>
      </Space>
    </Form>
  );
}
