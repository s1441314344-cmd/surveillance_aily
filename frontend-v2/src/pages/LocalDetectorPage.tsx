import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CameraOutlined, InboxOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api/errors';
import {
  detectWithLocalDetector,
  getLocalDetectorConfig,
  getLocalDetectorHealth,
  updateLocalDetectorConfig,
  type LocalDetectorDetectResult,
  type LocalDetectorRuleConfig,
} from '@/shared/api/localDetector';
import { captureCameraPhoto, fetchCameraMediaFile, listCameras } from '@/shared/api/configCenter';
import { DataStateBlock, PageHeader, SectionCard } from '@/shared/ui';

const { Text } = Typography;
const { Dragger } = Upload;

type FormValues = {
  personThreshold: number;
  selectedCameraId?: string;
  ruleMode: 'and' | 'or';
  rules?: Array<{
    signal_key: string;
    labels_text?: string;
    min_confidence: number;
    min_detections: number;
  }>;
};

type DetectionRecord = {
  id: string;
  createdAt: string;
  fileName: string;
  threshold: number;
  source: 'upload' | 'camera';
  result: LocalDetectorDetectResult;
};

type LocalDetectorConfigFormValues = {
  model_profile: 'speed' | 'balance' | 'custom';
  preprocess_mode: 'auto' | 'bgr_255' | 'rgb_255' | 'bgr_01' | 'rgb_01';
  score_threshold: number;
  nms_threshold: number;
  default_person_threshold: number;
  input_size: number;
  auto_download: boolean;
  model_name?: string;
  model_path?: string;
  model_url?: string;
};

export function LocalDetectorPage() {
  const [form] = Form.useForm<FormValues>();
  const [configForm] = Form.useForm<LocalDetectorConfigFormValues>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileSource, setSelectedFileSource] = useState<'upload' | 'camera'>('upload');
  const [latestResult, setLatestResult] = useState<LocalDetectorDetectResult | null>(null);
  const [records, setRecords] = useState<DetectionRecord[]>([]);

  const previewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const healthQuery = useQuery({
    queryKey: ['local-detector', 'health'],
    queryFn: getLocalDetectorHealth,
    refetchInterval: 10000,
  });
  const configQuery = useQuery({
    queryKey: ['local-detector', 'config'],
    queryFn: getLocalDetectorConfig,
  });
  const camerasQuery = useQuery({
    queryKey: ['local-detector', 'cameras'],
    queryFn: listCameras,
  });

  const selectedModelProfile = Form.useWatch('model_profile', configForm);

  useEffect(() => {
    const config = configQuery.data?.config;
    if (!config) {
      return;
    }
    configForm.setFieldsValue({
      model_profile: config.model_profile,
      preprocess_mode: config.preprocess_mode,
      score_threshold: config.score_threshold,
      nms_threshold: config.nms_threshold,
      default_person_threshold: config.default_person_threshold,
      input_size: config.input_size,
      auto_download: config.auto_download,
      model_name: config.model_name,
      model_path: config.model_path,
      model_url: config.model_url,
    });
    form.setFieldValue('personThreshold', config.default_person_threshold);
  }, [configForm, configQuery.data, form]);

  const configMutation = useMutation({
    mutationFn: updateLocalDetectorConfig,
    onSuccess: () => {
      message.success('检测服务配置已保存');
      void Promise.all([configQuery.refetch(), healthQuery.refetch()]);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '保存配置失败'));
    },
  });

  const cameraPhotoMutation = useMutation({
    mutationFn: async (cameraId: string) => {
      const photo = await captureCameraPhoto(cameraId, { sourceKind: 'local_detector_debug' });
      if (!photo.success || !photo.media?.id) {
        throw new Error(photo.error_message || '摄像头拍照失败');
      }
      const blob = await fetchCameraMediaFile(cameraId, photo.media.id);
      const file = new File([blob], photo.media.original_name || `camera-${cameraId}.jpg`, {
        type: photo.media.mime_type || 'image/jpeg',
      });
      return file;
    },
    onSuccess: (file) => {
      setSelectedFile(file);
      setSelectedFileSource('camera');
      message.success(`拍照成功，已加载：${file.name}`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头拍照失败'));
    },
  });

  const detectMutation = useMutation({
    mutationFn: detectWithLocalDetector,
    onSuccess: (result, variables) => {
      setLatestResult(result);
      setRecords((previous) => {
        const next: DetectionRecord[] = [
          {
            id: `${Date.now()}`,
            createdAt: new Date().toLocaleString(),
            fileName: variables.file.name,
            threshold: variables.personThreshold,
            source: selectedFileSource,
            result,
          },
          ...previous,
        ];
        return next.slice(0, 10);
      });
      message.success('本地检测完成');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '本地检测失败'));
    },
  });

  const signalRows = useMemo(() => {
    if (!latestResult) {
      return [];
    }
    return Object.entries(latestResult.signals).map(([signalKey, confidence]) => ({
      signalKey,
      confidence: Number(confidence ?? 0),
    }));
  }, [latestResult]);

  const ruleRows = latestResult?.rule_evaluation || [];

  const canRunDetect = Boolean(selectedFile) && !detectMutation.isPending;
  const cameraOptions = (camerasQuery.data || []).map((item) => ({
    label: `${item.name} (${item.id.slice(0, 8)})`,
    value: item.id,
  }));
  const modelProfileOptions = (configQuery.data?.model_profile_options || []).map((item) => ({
    label: item.label,
    value: item.value,
  }));
  const preprocessModeOptions = (configQuery.data?.preprocess_mode_options || []).map((item) => ({
    label: item.label,
    value: item.value,
  }));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="本地算法服务"
        title="本地检测"
        description="用于检查 local-detector 服务健康状态，并通过单图调试快速验证“人员前置门控”是否命中。"
      />

      <SectionCard title="服务状态" subtitle="实时查看 local-detector 可用性与就绪状态">
        <Space size={12} wrap>
          <Tag color={healthQuery.data?.ready ? 'success' : 'warning'}>
            {healthQuery.data?.ready ? '服务就绪' : '未就绪'}
          </Tag>
          <Tag color={healthQuery.data?.status === 'ok' ? 'success' : 'default'}>
            {healthQuery.data?.status ?? 'unknown'}
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => healthQuery.refetch()}
            loading={healthQuery.isFetching}
          >
            刷新状态
          </Button>
        </Space>
        {healthQuery.error ? (
          <DataStateBlock error={getApiErrorMessage(healthQuery.error, '状态检查失败')} minHeight={80} />
        ) : null}
        {healthQuery.data?.error ? (
          <Text type="warning">错误信息：{healthQuery.data.error}</Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="检测服务配置"
        subtitle="可视化维护模型方案、预处理方式与阈值。保存后自动应用到后续检测。"
      >
        {configQuery.error ? (
          <DataStateBlock error={getApiErrorMessage(configQuery.error, '读取配置失败')} minHeight={100} />
        ) : (
          <Form
            form={configForm}
            layout="vertical"
            onFinish={(values) => {
              const payload: LocalDetectorConfigFormValues = {
                model_profile: values.model_profile,
                preprocess_mode: values.preprocess_mode,
                score_threshold: Number(values.score_threshold),
                nms_threshold: Number(values.nms_threshold),
                default_person_threshold: Number(values.default_person_threshold),
                input_size: Number(values.input_size),
                auto_download: Boolean(values.auto_download),
                model_name: values.model_name?.trim(),
                model_path: values.model_path?.trim(),
                model_url: values.model_url?.trim(),
              };
              configMutation.mutate(payload);
            }}
          >
            <div className="page-grid page-grid--two">
              <Form.Item name="model_profile" label="模型方案" rules={[{ required: true, message: '请选择模型方案' }]}>
                <Select
                  options={
                    modelProfileOptions.length > 0
                      ? modelProfileOptions
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
                    preprocessModeOptions.length > 0
                      ? preprocessModeOptions
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

            {selectedModelProfile === 'custom' ? (
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
              <Button type="primary" htmlType="submit" loading={configMutation.isPending || configQuery.isFetching}>
                保存配置
              </Button>
              <Button onClick={() => configQuery.refetch()} loading={configQuery.isFetching}>
                重新读取
              </Button>
            </Space>
          </Form>
        )}
      </SectionCard>

      <div className="page-grid page-grid--two">
        <SectionCard title="单图调试" subtitle="上传图片并设置人员阈值，验证本地门控结果">
          <Form
            layout="vertical"
            form={form}
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
            onFinish={({ personThreshold, ruleMode, rules }) => {
              if (!selectedFile) {
                message.warning('请先上传图片');
                return;
              }
              const normalizedRules: LocalDetectorRuleConfig[] = (rules || [])
                .filter((item) => item.signal_key && item.labels_text)
                .map((item) => ({
                  signal_key: item.signal_key.trim().toLowerCase(),
                  labels: String(item.labels_text || '')
                    .split(',')
                    .map((label) => label.trim().toLowerCase())
                    .filter(Boolean),
                  min_confidence: Number(item.min_confidence),
                  min_detections: Number(item.min_detections),
                }))
                .filter((item) => item.labels.length > 0);
              detectMutation.mutate({
                file: selectedFile,
                personThreshold: Number(personThreshold),
                ruleMode,
                rules: normalizedRules,
              });
            }}
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
                  loading={camerasQuery.isLoading}
                  options={cameraOptions}
                />
              </Form.Item>
              <div style={{ alignSelf: 'end' }}>
                <Button
                  icon={<CameraOutlined />}
                  loading={cameraPhotoMutation.isPending}
                  onClick={() => {
                    const cameraId = form.getFieldValue('selectedCameraId');
                    if (!cameraId) {
                      message.warning('请先选择摄像头');
                      return;
                    }
                    cameraPhotoMutation.mutate(cameraId);
                  }}
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
                beforeUpload={(file) => {
                  setSelectedFile(file);
                  setSelectedFileSource('upload');
                  return false;
                }}
                onRemove={() => {
                  setSelectedFile(null);
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p>点击或拖拽上传图片</p>
              </Dragger>
            </Form.Item>
            <Space size={8} wrap style={{ marginBottom: 12 }}>
              <Tag color="blue">当前图片：{selectedFile?.name || '未选择'}</Tag>
              <Tag color={selectedFileSource === 'camera' ? 'purple' : 'default'}>
                来源：{selectedFileSource === 'camera' ? '摄像头拍照' : '本地上传'}
              </Tag>
            </Space>
            {previewUrl ? (
              <div className="local-detector-preview">
                <Image
                  src={previewUrl}
                  alt={selectedFile?.name || 'preview'}
                  className="local-detector-preview__image"
                />
                <Button
                  size="small"
                  onClick={() => {
                    window.open(previewUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
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
              <Button type="primary" htmlType="submit" loading={detectMutation.isPending} disabled={!canRunDetect}>
                执行本地检测
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setSelectedFile(null);
                  setLatestResult(null);
                }}
              >
                清空
              </Button>
            </Space>
          </Form>
        </SectionCard>

        <SectionCard title="检测结果" subtitle="展示 decision / signals / detections 三类核心信息">
          {!latestResult ? (
            <DataStateBlock empty emptyDescription="执行一次本地检测后，这里会展示结果。" minHeight={220} />
          ) : (
            <Space orientation="vertical" className="stack-full" size={12}>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="门控判定">
                  <Tag color={latestResult.decision.pass ? 'success' : 'error'}>
                    {latestResult.decision.pass ? 'PASS' : 'BLOCK'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="判定原因">{latestResult.decision.reason}</Descriptions.Item>
                <Descriptions.Item label="模型">{latestResult.model_meta.model_name}</Descriptions.Item>
                <Descriptions.Item label="预处理方案">
                  {latestResult.model_meta.preprocess_variant || 'unknown'}
                </Descriptions.Item>
                <Descriptions.Item label="检测阈值">
                  模型阈值 {typeof latestResult.model_meta.score_threshold === 'number'
                    ? latestResult.model_meta.score_threshold.toFixed(2)
                    : '-'}
                  {' / '}
                  人员门控阈值 {typeof latestResult.model_meta.person_threshold === 'number'
                    ? latestResult.model_meta.person_threshold.toFixed(2)
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="推理时延">{latestResult.model_meta.latency_ms} ms</Descriptions.Item>
              </Descriptions>

              <Table
                rowKey="signalKey"
                size="small"
                pagination={false}
                dataSource={signalRows}
                columns={[
                  { title: 'Signal', dataIndex: 'signalKey', key: 'signalKey' },
                  {
                    title: '置信度',
                    dataIndex: 'confidence',
                    key: 'confidence',
                    render: (value: number) => value.toFixed(4),
                  },
                ]}
              />

              <Table
                rowKey={(_, index) => String(index)}
                size="small"
                pagination={{ pageSize: 5, showSizeChanger: false }}
                dataSource={latestResult.detections}
                locale={{ emptyText: <Empty description="无检测框" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: '类别', dataIndex: 'label', key: 'label' },
                  {
                    title: '置信度',
                    dataIndex: 'confidence',
                    key: 'confidence',
                    render: (value: number) => value.toFixed(4),
                  },
                  {
                    title: 'BBox',
                    dataIndex: 'bbox',
                    key: 'bbox',
                    render: (value: [number, number, number, number]) => value.join(', '),
                  },
                ]}
              />

              <Table
                rowKey={(_, index) => String(index)}
                size="small"
                pagination={false}
                dataSource={ruleRows}
                locale={{ emptyText: <Empty description="未配置规则或无规则评估结果" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                columns={[
                  { title: 'Signal', dataIndex: 'signal_key', key: 'signal_key' },
                  {
                    title: 'Labels',
                    dataIndex: 'labels',
                    key: 'labels',
                    render: (value: string[]) => (value || []).join(', '),
                  },
                  {
                    title: '命中数',
                    dataIndex: 'matched_count',
                    key: 'matched_count',
                  },
                  {
                    title: '结果',
                    dataIndex: 'passed',
                    key: 'passed',
                    render: (value: boolean) => (
                      <Tag color={value ? 'success' : 'error'}>{value ? 'PASS' : 'BLOCK'}</Tag>
                    ),
                  },
                ]}
              />
            </Space>
          )}
        </SectionCard>
      </div>

      <SectionCard title="最近调试记录" subtitle="保留最近 10 次执行结果，便于快速比对">
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5, showSizeChanger: false }}
          dataSource={records}
          locale={{ emptyText: '暂无记录' }}
          columns={[
            { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
            { title: '文件名', dataIndex: 'fileName', key: 'fileName' },
            {
              title: '阈值',
              dataIndex: 'threshold',
              key: 'threshold',
              width: 120,
              render: (value: number) => value.toFixed(2),
            },
            {
              title: '来源',
              dataIndex: 'source',
              key: 'source',
              width: 120,
              render: (value: 'upload' | 'camera') => (
                <Tag color={value === 'camera' ? 'purple' : 'default'}>
                  {value === 'camera' ? '摄像头' : '上传'}
                </Tag>
              ),
            },
            {
              title: '结果',
              key: 'decision',
              width: 120,
              render: (_, record) => (
                <Tag color={record.result.decision.pass ? 'success' : 'error'}>
                  {record.result.decision.pass ? 'PASS' : 'BLOCK'}
                </Tag>
              ),
            },
            {
              title: '主要原因',
              key: 'reason',
              render: (_, record) => (
                <Typography.Text ellipsis={{ tooltip: record.result.decision.reason }}>
                  {record.result.decision.reason}
                </Typography.Text>
              ),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}
