import { Button, Col, Empty, Form, Input, InputNumber, Popconfirm, Row, Select, Space, Typography } from 'antd';
import { useCameraCenter } from './useCameraCenter';
import {
  CAMERA_PROTOCOL_OPTIONS,
  CAMERA_RESOLUTION_OPTIONS,
  DEFAULT_CAMERA_VALUES,
  type CameraFormValues,
} from './cameraCenterConfig';
import { SectionCard } from '@/shared/ui';
import { CameraPaneHeader } from './CameraPaneHeader';

const { Paragraph, Text } = Typography;

const DEVICE_HINTS = [
  '设备页只管理连接参数与采集参数。',
  '状态检查与深度诊断请切到“诊断状态”。',
  '抽帧规则与自动命中请切到“监测与规则”。',
];
const FORM_GUTTER = 16;

export function DevicesPane() {
  const {
    form,
    activeCamera,
    createOrUpdateCameraLoading,
    deleteCameraLoading,
    handleSubmit,
    deleteSelectedCamera,
    resetForCreate,
    isCreateMode,
  } = useCameraCenter();
  const passwordLabel = activeCamera?.has_password ? '密码(留空不修改)' : '密码';
  const handleFormFinish = (values: CameraFormValues) => {
    void handleSubmit(values);
  };

  return (
    <Space direction="vertical" size={16} className="stack-full">
      <CameraPaneHeader
        title="设备台账与连接参数"
        description="维护摄像头基础信息、连接参数和抽帧参数。规则、媒体和诊断能力已拆分到独立子页。"
      />

      <SectionCard
        title={isCreateMode ? '新建设备' : '设备配置'}
        actions={
          activeCamera ? (
            <Popconfirm
              title="确定删除该摄像头吗？"
              description="删除后将清理当前设备的状态日志与关联视图。"
              onConfirm={deleteSelectedCamera}
              okText="删除"
              cancelText="取消"
            >
              <Button danger size="small" loading={deleteCameraLoading}>
                删除设备
              </Button>
            </Popconfirm>
          ) : null
        }
      >
        <Paragraph type="secondary" className="page-paragraph-reset">
          这里专注维护摄像头台账和连接参数，不再混入规则、媒体和诊断操作。
        </Paragraph>

        <Form layout="vertical" form={form} onFinish={handleFormFinish} initialValues={DEFAULT_CAMERA_VALUES}>
          <Row gutter={FORM_GUTTER}>
            <Col xs={24} md={12}>
              <Form.Item label="设备名称" name="name" rules={[{ required: true, message: '请输入设备名称' }]}>
                <Input placeholder="例如 东门枪机-01" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="位置信息" name="location">
                <Input placeholder="例如 东侧门岗" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={FORM_GUTTER}>
            <Col xs={24} md={8}>
              <Form.Item label="协议" name="protocol" rules={[{ required: true, message: '请选择协议' }]}>
                <Select options={[...CAMERA_PROTOCOL_OPTIONS]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="IP 地址" name="ip_address">
                <Input placeholder="192.168.1.10" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="端口" name="port">
                <InputNumber min={1} className="input-full" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={FORM_GUTTER}>
            <Col xs={24} md={12}>
              <Form.Item label="用户名" name="username">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={passwordLabel} name="password">
                <Input.Password placeholder="可选" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="RTSP 地址" name="rtsp_url">
            <Input placeholder="rtsp://example/live" />
          </Form.Item>

          <Row gutter={FORM_GUTTER}>
            <Col xs={24} md={8}>
              <Form.Item
                label="抽帧频率(秒)"
                name="frame_frequency_seconds"
                rules={[{ required: true, message: '请输入抽帧频率' }]}
              >
                <InputNumber min={1} className="input-full" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="分辨率" name="resolution" rules={[{ required: true, message: '请输入分辨率' }]}>
                <Select options={[...CAMERA_RESOLUTION_OPTIONS]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="JPEG 质量" name="jpeg_quality" rules={[{ required: true, message: '请输入质量' }]}>
                <InputNumber min={1} max={100} className="input-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="存储路径" name="storage_path" rules={[{ required: true, message: '请输入存储路径' }]}>
            <Input placeholder="./data/storage/cameras" />
          </Form.Item>

          <Space wrap>
            <Button type="primary" htmlType="submit" loading={createOrUpdateCameraLoading}>
              {isCreateMode ? '创建摄像头' : '保存修改'}
            </Button>
            <Button onClick={resetForCreate}>新建另一台设备</Button>
          </Space>
        </Form>
      </SectionCard>

      {!activeCamera && !isCreateMode ? (
        <SectionCard>
          <Empty description="请选择左侧摄像头开始维护设备信息" />
        </SectionCard>
      ) : null}

      <SectionCard title="配置提示">
        <Space direction="vertical" size={4}>
          {DEVICE_HINTS.map((hint, index) => (
            <Text key={hint}>{`${index + 1}. ${hint}`}</Text>
          ))}
        </Space>
      </SectionCard>
    </Space>
  );
}
