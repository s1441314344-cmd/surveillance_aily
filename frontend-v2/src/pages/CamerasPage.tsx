import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Switch,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  Camera,
  CameraDiagnostic,
  CameraPayload,
  checkAllCamerasStatus,
  checkCameraStatus,
  createCamera,
  deleteCamera,
  diagnoseCamera,
  getCameraStatus,
  listCameraStatuses,
  listCameras,
  updateCamera,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const { Paragraph, Text, Title } = Typography;
const CREATE_CAMERA_ID = '__create__';

type CameraFormValues = {
  name: string;
  location?: string;
  ip_address?: string;
  port?: number;
  protocol: string;
  username?: string;
  password?: string;
  rtsp_url?: string;
  frame_frequency_seconds: number;
  resolution: string;
  jpeg_quality: number;
  storage_path: string;
};

const DEFAULT_CAMERA_VALUES: CameraFormValues = {
  name: '',
  location: '',
  ip_address: '',
  port: 554,
  protocol: 'rtsp',
  username: '',
  password: '',
  rtsp_url: '',
  frame_frequency_seconds: 60,
  resolution: '1080p',
  jpeg_quality: 80,
  storage_path: './data/storage/cameras',
};

const statusColorMap: Record<string, string> = {
  online: 'green',
  warning: 'gold',
  offline: 'red',
  unknown: 'default',
};

export function CamerasPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CameraFormValues>();
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [alertOnly, setAlertOnly] = useState(false);
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [lastDiagnostic, setLastDiagnostic] = useState<CameraDiagnostic | null>(null);

  const cameraQuery = useQuery({
    queryKey: ['cameras'],
    queryFn: listCameras,
  });

  const cameras = useMemo(() => cameraQuery.data ?? [], [cameraQuery.data]);
  const effectiveSelectedCameraId = useMemo(() => {
    if (selectedCameraId === CREATE_CAMERA_ID) {
      return null;
    }

    const exists = selectedCameraId && cameras.some((item) => item.id === selectedCameraId);
    return exists ? selectedCameraId : cameras[0]?.id ?? null;
  }, [cameras, selectedCameraId]);
  const activeCamera = useMemo(
    () => cameras.find((item) => item.id === effectiveSelectedCameraId) ?? null,
    [cameras, effectiveSelectedCameraId],
  );

  const statusQuery = useQuery({
    queryKey: ['camera-status', effectiveSelectedCameraId],
    queryFn: () => getCameraStatus(effectiveSelectedCameraId as string),
    enabled: Boolean(effectiveSelectedCameraId),
    refetchInterval: 10000,
  });

  const statusListQuery = useQuery({
    queryKey: ['camera-statuses', cameras.map((item) => item.id).join(',')],
    queryFn: () => listCameraStatuses({ cameraIds: cameras.map((item) => item.id) }),
    enabled: cameras.length > 0,
    refetchInterval: 10000,
  });

  const cameraStatusMap = useMemo(() => {
    const statuses = statusListQuery.data ?? [];
    return Object.fromEntries(statuses.map((item) => [item.camera_id, item]));
  }, [statusListQuery.data]);

  const visibleCameras = useMemo(() => {
    if (!alertOnly) {
      return cameras;
    }
    return cameras.filter((camera) => (cameraStatusMap[camera.id]?.alert_status ?? 'normal') !== 'normal');
  }, [alertOnly, cameraStatusMap, cameras]);

  const statusSummary = useMemo(() => {
    const summary = {
      online: 0,
      warning: 0,
      offline: 0,
      unknown: 0,
      abnormal: 0,
    };
    for (const camera of cameras) {
      const status = cameraStatusMap[camera.id];
      const connectionStatus = status?.connection_status ?? 'unknown';
      if (connectionStatus in summary) {
        summary[connectionStatus as keyof typeof summary] += 1;
      } else {
        summary.unknown += 1;
      }
      if ((status?.alert_status ?? 'normal') !== 'normal') {
        summary.abnormal += 1;
      }
    }
    return summary;
  }, [cameraStatusMap, cameras]);

  const selectedCameraStatus = useMemo(() => {
    if (!effectiveSelectedCameraId) {
      return null;
    }
    return statusQuery.data ?? cameraStatusMap[effectiveSelectedCameraId] ?? null;
  }, [cameraStatusMap, effectiveSelectedCameraId, statusQuery.data]);

  useEffect(() => {
    if (!activeCamera) {
      form.setFieldsValue(DEFAULT_CAMERA_VALUES);
      return;
    }

    form.setFieldsValue({
      name: activeCamera.name,
      location: activeCamera.location ?? '',
      ip_address: activeCamera.ip_address ?? '',
      port: activeCamera.port ?? 554,
      protocol: activeCamera.protocol,
      username: activeCamera.username ?? '',
      password: '',
      rtsp_url: activeCamera.rtsp_url ?? '',
      frame_frequency_seconds: activeCamera.frame_frequency_seconds,
      resolution: activeCamera.resolution,
      jpeg_quality: activeCamera.jpeg_quality,
      storage_path: activeCamera.storage_path,
    });
  }, [activeCamera, form]);

  const invalidateCameraQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cameras'] }),
      queryClient.invalidateQueries({ queryKey: ['camera-status'] }),
      queryClient.invalidateQueries({ queryKey: ['camera-statuses'] }),
    ]);

  const createMutation = useMutation({
    mutationFn: createCamera,
    onSuccess: async (camera) => {
      await invalidateCameraQueries();
      setSelectedCameraId(camera.id);
      message.success('摄像头已创建');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头创建失败'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ cameraId, payload }: { cameraId: string; payload: Partial<CameraPayload> }) =>
      updateCamera(cameraId, payload),
    onSuccess: async () => {
      await invalidateCameraQueries();
      message.success('摄像头配置已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头更新失败'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCamera,
    onSuccess: async () => {
      await invalidateCameraQueries();
      setSelectedCameraId(null);
      form.setFieldsValue(DEFAULT_CAMERA_VALUES);
      message.success('摄像头已删除');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头删除失败'));
    },
  });

  const checkMutation = useMutation({
    mutationFn: checkCameraStatus,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['camera-status', result.camera_id] }),
        queryClient.invalidateQueries({ queryKey: ['camera-statuses'] }),
      ]);
      message.success('摄像头状态检查完成');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头状态检查失败'));
    },
  });

  const sweepMutation = useMutation({
    mutationFn: (cameraIds?: string[]) => checkAllCamerasStatus({ cameraIds }),
    onSuccess: async (summary) => {
      await invalidateCameraQueries();
      message.success(
        `全量巡检完成：检查 ${summary.checked_count}/${summary.total_count}，失败 ${summary.failed_count}`,
      );
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '全量巡检失败'));
    },
  });

  const diagnoseMutation = useMutation({
    mutationFn: (cameraId: string) => diagnoseCamera(cameraId),
    onSuccess: async (diagnostic) => {
      setLastDiagnostic(diagnostic);
      setDiagnosticModalOpen(true);
      await invalidateCameraQueries();
      if (diagnostic.success) {
        message.success('摄像头深度诊断完成');
      } else {
        message.warning('摄像头深度诊断完成，发现异常');
      }
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头深度诊断失败'));
    },
  });

  const resetForCreate = () => {
    setSelectedCameraId(CREATE_CAMERA_ID);
    form.setFieldsValue(DEFAULT_CAMERA_VALUES);
  };

  const handleSubmit = async (values: CameraFormValues) => {
    const payload: CameraPayload = {
      ...values,
      location: values.location?.trim() || null,
      ip_address: values.ip_address?.trim() || null,
      username: values.username?.trim() || null,
      rtsp_url: values.rtsp_url?.trim() || null,
      password: values.password?.trim() || undefined,
      port: values.port ? Number(values.port) : null,
      frame_frequency_seconds: Number(values.frame_frequency_seconds),
      jpeg_quality: Number(values.jpeg_quality),
    };

    if (effectiveSelectedCameraId) {
      await updateMutation.mutateAsync({ cameraId: effectiveSelectedCameraId, payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          摄像头中心
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          管理 RTSP 摄像头的连接参数、抽帧配置和状态检查结果，为后续单次任务与定时任务提供输入源。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={8}>
          <Card
            title="摄像头列表"
            extra={
              <Space>
                <Space size={6}>
                  <Text type="secondary">仅看告警</Text>
                  <Switch
                    size="small"
                    checked={alertOnly}
                    onChange={setAlertOnly}
                    data-testid="cameras-alert-only-switch"
                  />
                </Space>
                <Button
                  size="small"
                  loading={sweepMutation.isPending}
                  disabled={!cameras.length}
                  data-testid="cameras-bulk-check-btn"
                  onClick={() => sweepMutation.mutate(cameras.map((item) => item.id))}
                >
                  全量巡检
                </Button>
                <Button size="small" type="primary" onClick={resetForCreate}>
                  新建
                </Button>
              </Space>
            }
            style={{ height: '100%' }}
          >
            {cameras.length ? (
              <Alert
                type={statusSummary.abnormal > 0 ? 'warning' : 'success'}
                showIcon
                style={{ marginBottom: 12 }}
                title={`在线 ${statusSummary.online} / 告警 ${statusSummary.abnormal}`}
                description={
                  <Space wrap size={8}>
                    <Tag color={statusColorMap.online}>online: {statusSummary.online}</Tag>
                    <Tag color={statusColorMap.warning}>warning: {statusSummary.warning}</Tag>
                    <Tag color={statusColorMap.offline}>offline: {statusSummary.offline}</Tag>
                    <Tag color={statusColorMap.unknown}>unknown: {statusSummary.unknown}</Tag>
                  </Space>
                }
              />
            ) : null}
            {cameraQuery.isLoading ? (
              <Spin />
            ) : visibleCameras.length ? (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {visibleCameras.map((camera: Camera) => (
                  <Card
                    key={camera.id}
                    size="small"
                    hoverable
                    style={{
                      borderColor: camera.id === effectiveSelectedCameraId ? '#1677ff' : undefined,
                    }}
                    onClick={() => setSelectedCameraId(camera.id)}
                  >
                    <Space orientation="vertical" size={4}>
                      <Space>
                        <Text strong>{camera.name}</Text>
                        <Tag>{camera.protocol.toUpperCase()}</Tag>
                        <Tag color={statusColorMap[cameraStatusMap[camera.id]?.connection_status ?? 'unknown'] ?? 'default'}>
                          {cameraStatusMap[camera.id]?.connection_status ?? 'unknown'}
                        </Tag>
                        {(cameraStatusMap[camera.id]?.alert_status ?? 'normal') !== 'normal' ? (
                          <Tag color={statusColorMap[cameraStatusMap[camera.id]?.alert_status ?? 'warning'] ?? 'gold'}>
                            {cameraStatusMap[camera.id]?.alert_status}
                          </Tag>
                        ) : null}
                      </Space>
                      <Text type="secondary">{camera.location || '未设置位置'}</Text>
                      <Text type="secondary">{camera.rtsp_url || camera.ip_address || '未配置地址'}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : alertOnly ? (
              <Empty description="当前没有告警摄像头" />
            ) : (
              <Empty description="暂无摄像头配置" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Card
              title={effectiveSelectedCameraId ? '编辑摄像头' : '新建摄像头'}
              extra={
                activeCamera ? (
                  <Space>
                    <Button
                      size="small"
                      onClick={() => checkMutation.mutate(activeCamera.id)}
                      loading={checkMutation.isPending}
                    >
                      立即检查
                    </Button>
                    <Button
                      size="small"
                      onClick={() => diagnoseMutation.mutate(activeCamera.id)}
                      loading={diagnoseMutation.isPending}
                      data-testid="cameras-diagnose-btn"
                    >
                      深度诊断
                    </Button>
                    <Popconfirm
                      title="确定删除该摄像头吗？"
                      description="删除后将一并清理当前状态日志。"
                      onConfirm={() => deleteMutation.mutate(activeCamera.id)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button danger size="small" loading={deleteMutation.isPending}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ) : null
              }
            >
              <Form layout="vertical" form={form} onFinish={handleSubmit} initialValues={DEFAULT_CAMERA_VALUES}>
                <Row gutter={16}>
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

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item label="协议" name="protocol" rules={[{ required: true, message: '请选择协议' }]}>
                      <Select
                        options={[
                          { label: 'RTSP', value: 'rtsp' },
                          { label: 'ONVIF', value: 'onvif' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="IP 地址" name="ip_address">
                      <Input placeholder="192.168.1.10" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="端口" name="port">
                      <Input type="number" min={1} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="用户名" name="username">
                      <Input placeholder="可选" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label={activeCamera?.has_password ? '密码(留空不修改)' : '密码'} name="password">
                      <Input.Password placeholder="可选" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="RTSP 地址" name="rtsp_url">
                  <Input placeholder="rtsp://example/live" />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="抽帧频率(秒)"
                      name="frame_frequency_seconds"
                      rules={[{ required: true, message: '请输入抽帧频率' }]}
                    >
                      <Input type="number" min={1} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="分辨率" name="resolution" rules={[{ required: true, message: '请输入分辨率' }]}>
                      <Select
                        options={[
                          { label: '1080p', value: '1080p' },
                          { label: '720p', value: '720p' },
                          { label: '4K', value: '4k' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="JPEG 质量" name="jpeg_quality" rules={[{ required: true, message: '请输入质量' }]}>
                      <Input type="number" min={1} max={100} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="存储路径" name="storage_path" rules={[{ required: true, message: '请输入存储路径' }]}>
                  <Input placeholder="./data/storage/cameras" />
                </Form.Item>

                <Space wrap>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={createMutation.isPending || updateMutation.isPending}
                  >
                    {effectiveSelectedCameraId ? '保存修改' : '创建摄像头'}
                  </Button>
                  <Button onClick={resetForCreate}>清空重建</Button>
                </Space>
              </Form>
            </Card>

            <Card title="状态概览">
              {effectiveSelectedCameraId ? (
                statusQuery.isLoading ? (
                  <Spin />
                ) : (
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="连接状态">
                      <Tag color={statusColorMap[selectedCameraStatus?.connection_status ?? 'unknown'] ?? 'default'}>
                        {selectedCameraStatus?.connection_status ?? 'unknown'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="告警状态">
                      <Tag color={statusColorMap[selectedCameraStatus?.alert_status ?? 'unknown'] ?? 'default'}>
                        {selectedCameraStatus?.alert_status ?? 'unknown'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="最近检查时间">
                      {selectedCameraStatus?.last_checked_at ?? '尚未检查'}
                    </Descriptions.Item>
                    <Descriptions.Item label="最近错误">
                      {selectedCameraStatus?.last_error || '无'}
                    </Descriptions.Item>
                  </Descriptions>
                )
              ) : (
                <Empty description="请选择一个摄像头查看状态" />
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        open={diagnosticModalOpen}
        title="摄像头诊断结果"
        onCancel={() => setDiagnosticModalOpen(false)}
        footer={
          <Button type="primary" onClick={() => setDiagnosticModalOpen(false)}>
            关闭
          </Button>
        }
      >
        {lastDiagnostic ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="摄像头">
              {lastDiagnostic.camera_name} ({lastDiagnostic.camera_id})
            </Descriptions.Item>
            <Descriptions.Item label="诊断状态">
              <Tag color={lastDiagnostic.success ? 'green' : 'red'}>
                {lastDiagnostic.success ? '成功' : '失败'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="协议">
              {lastDiagnostic.protocol.toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="采集模式">
              {lastDiagnostic.capture_mode}
            </Descriptions.Item>
            <Descriptions.Item label="时延">
              {lastDiagnostic.latency_ms} ms
            </Descriptions.Item>
            <Descriptions.Item label="图像尺寸">
              {lastDiagnostic.width && lastDiagnostic.height
                ? `${lastDiagnostic.width} x ${lastDiagnostic.height}`
                : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {lastDiagnostic.frame_size_bytes ? `${lastDiagnostic.frame_size_bytes} bytes` : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="媒体类型">
              {lastDiagnostic.mime_type ?? '无'}
            </Descriptions.Item>
            <Descriptions.Item label="脱敏地址">
              {lastDiagnostic.stream_url_masked ?? '无'}
            </Descriptions.Item>
            <Descriptions.Item label="诊断快照路径">
              {lastDiagnostic.snapshot_path ?? '无'}
            </Descriptions.Item>
            <Descriptions.Item label="错误信息">
              {lastDiagnostic.error_message ?? '无'}
            </Descriptions.Item>
            <Descriptions.Item label="诊断时间">
              {lastDiagnostic.checked_at}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="暂无诊断结果" />
        )}
      </Modal>
    </Space>
  );
}
