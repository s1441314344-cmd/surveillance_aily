import { Button, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import type { useLocalDetectorPageController } from '@/pages/local-detector/useLocalDetectorPageController';
import { getLocalDetectorErrorMessage } from '@/pages/local-detector/localDetectorErrorMessage';

type LocalDetectorPageController = ReturnType<typeof useLocalDetectorPageController>;

type LocalDetectorConfigSectionProps = {
  controller: LocalDetectorPageController;
};

export function LocalDetectorConfigSection({ controller }: LocalDetectorConfigSectionProps) {
  return (
    <SectionCard
      title="检测服务配置"
      subtitle="可视化维护模型方案、预处理方式与阈值。保存后自动应用到后续检测。"
    >
      {controller.queries.configQuery.error ? (
        <DataStateBlock
          error={getLocalDetectorErrorMessage(controller.queries.configQuery.error, '读取配置失败')}
          minHeight={100}
        />
      ) : (
        <Form
          form={controller.forms.configForm}
          layout="vertical"
          onFinish={controller.actions.handleConfigSubmit}
        >
          <div className="page-grid page-grid--two">
            <Form.Item name="model_profile" label="模型方案" rules={[{ required: true, message: '请选择模型方案' }]}>
              <Select
                options={
                  controller.options.modelProfileOptions.length > 0
                    ? controller.options.modelProfileOptions
                    : [
                        { value: 'speed', label: '速度优先（yolox-nano）' },
                        { value: 'balance', label: '平衡档（yolox-s）' },
                        { value: 'custom', label: '自定义' },
                      ]
                }
              />
            </Form.Item>

            <Form.Item
              name="preprocess_mode"
              label="预处理方案"
              rules={[{ required: true, message: '请选择预处理方案' }]}
            >
              <Select
                options={
                  controller.options.preprocessModeOptions.length > 0
                    ? controller.options.preprocessModeOptions
                    : [
                        { value: 'auto', label: '自动选择' },
                        { value: 'bgr_255', label: 'BGR 0-255' },
                        { value: 'rgb_255', label: 'RGB 0-255' },
                        { value: 'bgr_01', label: 'BGR 0-1' },
                        { value: 'rgb_01', label: 'RGB 0-1' },
                      ]
                }
              />
            </Form.Item>

            <Form.Item name="score_threshold" label="模型阈值" rules={[{ required: true, message: '请输入模型阈值' }]}>
              <InputNumber min={0} max={1} step={0.01} precision={2} className="input-full" />
            </Form.Item>

            <Form.Item name="nms_threshold" label="NMS 阈值" rules={[{ required: true, message: '请输入 NMS 阈值' }]}>
              <InputNumber min={0} max={1} step={0.01} precision={2} className="input-full" />
            </Form.Item>

            <Form.Item
              name="default_person_threshold"
              label="人员门控阈值"
              rules={[{ required: true, message: '请输入人员门控阈值' }]}
            >
              <InputNumber min={0} max={1} step={0.01} precision={2} className="input-full" />
            </Form.Item>

            <Form.Item name="input_size" label="输入尺寸" rules={[{ required: true, message: '请输入输入尺寸' }]}>
              <InputNumber min={160} max={1280} step={32} precision={0} className="input-full" />
            </Form.Item>

            <Form.Item name="auto_download" label="自动下载模型" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </div>

          {controller.state.selectedModelProfile === 'custom' ? (
            <div className="page-grid page-grid--two">
              <Form.Item
                name="model_name"
                label="模型名称"
                rules={[{ required: true, message: '请输入模型名称' }]}
              >
                <Input placeholder="custom-onnx" />
              </Form.Item>
              <Form.Item
                name="model_path"
                label="模型路径"
                rules={[{ required: true, message: '请输入模型路径' }]}
              >
                <Input placeholder="/tmp/models/custom.onnx" />
              </Form.Item>
              <Form.Item name="model_url" label="模型下载地址（可选）">
                <Input placeholder="https://..." />
              </Form.Item>
            </div>
          ) : null}

          <Space wrap>
            <Button
              type="primary"
              htmlType="submit"
              loading={controller.mutations.configMutation.isPending || controller.queries.configQuery.isFetching}
            >
              保存配置
            </Button>
            <Button
              onClick={() => controller.queries.configQuery.refetch()}
              loading={controller.queries.configQuery.isFetching}
            >
              重新读取
            </Button>
          </Space>
        </Form>
      )}
    </SectionCard>
  );
}
