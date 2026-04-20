import { Button, Form, Image, Input, InputNumber, Select, Space, Tag, Upload } from 'antd';
import { CameraOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { SectionCard } from '@/shared/ui';
import type { useLocalDetectorPageController } from '@/pages/local-detector/useLocalDetectorPageController';

type LocalDetectorPageController = ReturnType<typeof useLocalDetectorPageController>;

type LocalDetectorDebugSectionProps = {
  controller: LocalDetectorPageController;
};

const { Dragger } = Upload;

export function LocalDetectorDebugSection({ controller }: LocalDetectorDebugSectionProps) {
  return (
    <SectionCard title="单图调试" subtitle="上传图片并设置人员阈值，验证本地门控结果">
      <Form
        layout="vertical"
        form={controller.forms.form}
        initialValues={{
          personThreshold: 0.35,
          ruleMode: 'and',
          rules: [
            {
              signal_key: 'person',
              labels_text: 'person',
              min_confidence: 0.35,
              min_detections: 1,
            },
          ],
        }}
        onFinish={controller.actions.handleDetectSubmit}
      >
        <Space wrap className="stack-full">
          <Form.Item
            name="selectedCameraId"
            label="摄像头（可拍照送检）"
            className="page-toolbar-field--lg"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择摄像头"
              loading={controller.queries.camerasQuery.isLoading}
              options={controller.options.cameraOptions}
            />
          </Form.Item>
          <div style={{ alignSelf: 'end' }}>
            <Button
              icon={<CameraOutlined />}
              loading={controller.mutations.cameraPhotoMutation.isPending}
              onClick={controller.actions.handleCaptureCameraPhoto}
            >
              摄像头拍照并加载
            </Button>
          </div>
        </Space>

        <Form.Item label="图片文件" required>
          <Dragger
            className="local-detector-uploader"
            maxCount={1}
            showUploadList={{ showRemoveIcon: true }}
            beforeUpload={controller.actions.handleSelectUpload}
            onRemove={controller.actions.handleRemoveUpload}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>点击或拖拽上传图片</p>
          </Dragger>
        </Form.Item>
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          <Tag color="blue">当前图片：{controller.state.selectedFile?.name || '未选择'}</Tag>
          <Tag color={controller.state.selectedFileSource === 'camera' ? 'purple' : 'default'}>
            来源：{controller.state.selectedFileSource === 'camera' ? '摄像头拍照' : '本地上传'}
          </Tag>
        </Space>
        {controller.state.previewUrl ? (
          <div className="local-detector-preview">
            <Image
              src={controller.state.previewUrl}
              alt={controller.state.selectedFile?.name || 'preview'}
              className="local-detector-preview__image"
            />
            <Button size="small" onClick={controller.actions.handleOpenPreviewWindow}>
              新窗口查看原图
            </Button>
          </div>
        ) : null}

        <Form.Item
          name="personThreshold"
          label="人员阈值（person_threshold）"
          rules={[
            { required: true, message: '请输入阈值' },
            {
              validator: async (_, value: number) => {
                if (value < 0 || value > 1) {
                  throw new Error('阈值范围必须在 0 到 1 之间');
                }
              },
            },
          ]}
        >
          <InputNumber min={0} max={1} step={0.05} precision={2} className="input-full" />
        </Form.Item>

        <SectionCard
          title="规则配置（可扩展）"
          subtitle="支持配置多个 signal 规则，按 and/or 组合判定。labels 使用逗号分隔（示例：person,car,truck）。"
        >
          <Form.Item name="ruleMode" label="规则组合方式">
            <Select
              options={[
                { value: 'and', label: 'AND（全部规则通过）' },
                { value: 'or', label: 'OR（任一规则通过）' },
              ]}
            />
          </Form.Item>
          <Form.List name="rules">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" className="stack-full">
                {fields.map((field) => (
                  <div key={field.key} className="call-log-detail-grid">
                    <Form.Item
                      {...field}
                      name={[field.name, 'signal_key']}
                      label="Signal Key"
                      rules={[{ required: true, message: '必填' }]}
                    >
                      <Input placeholder="如：person / vehicle / custom_fire" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'labels_text']}
                      label="Labels"
                      rules={[{ required: true, message: '必填' }]}
                    >
                      <Input placeholder="如：person,car,truck" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'min_confidence']}
                      label="最小置信度"
                      rules={[{ required: true, message: '必填' }]}
                    >
                      <InputNumber min={0} max={1} step={0.05} precision={2} className="input-full" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'min_detections']}
                      label="最小目标数"
                      rules={[{ required: true, message: '必填' }]}
                    >
                      <InputNumber min={1} step={1} precision={0} className="input-full" />
                    </Form.Item>
                    <div style={{ alignSelf: 'end' }}>
                      <Button danger onClick={() => remove(field.name)}>
                        删除规则
                      </Button>
                    </div>
                  </div>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add({ min_confidence: 0.35, min_detections: 1 })}>
                  新增规则
                </Button>
              </Space>
            )}
          </Form.List>
        </SectionCard>

        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={controller.mutations.detectMutation.isPending}
            disabled={!controller.options.canRunDetect}
          >
            执行本地检测
          </Button>
          <Button onClick={controller.actions.handleClear}>清空</Button>
        </Space>
      </Form>
    </SectionCard>
  );
}
