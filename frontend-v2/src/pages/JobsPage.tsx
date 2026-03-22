import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { InboxOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api/errors';
import { listStrategies } from '@/shared/api/configCenter';
import { cancelJob, getJob, Job, listJobs, uploadJob } from '@/shared/api/tasks';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

type UploadFormValues = {
  strategyId: string;
};

const statusColorMap: Record<string, string> = {
  queued: 'default',
  running: 'processing',
  completed: 'green',
  failed: 'red',
  cancelled: 'orange',
};

export function JobsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UploadFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'active'],
    queryFn: () => listStrategies({ status: 'active' }),
  });

  const jobsQuery = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () =>
      listJobs({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    refetchInterval: 5000,
  });

  const selectedJobQuery = useQuery({
    queryKey: ['job-detail', selectedJobId],
    queryFn: () => getJob(selectedJobId as string),
    enabled: Boolean(selectedJobId),
  });

  const strategies = strategyQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const selectedJob = useMemo(() => selectedJobQuery.data ?? null, [selectedJobQuery.data]);

  const invalidateJobs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['job-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['task-records'] }),
    ]);

  const uploadMutation = useMutation({
    mutationFn: uploadJob,
    onSuccess: async (job) => {
      await invalidateJobs();
      setSelectedJobId(job.id);
      setFileList([]);
      form.resetFields();
      message.success('上传任务已创建并完成首版分析');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '上传任务创建失败'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: async (job) => {
      await invalidateJobs();
      setSelectedJobId(job.id);
      message.success('任务状态已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '取消任务失败'));
    },
  });

  const handleUploadSubmit = async (values: UploadFormValues) => {
    const files = fileList
      .map((item) => item.originFileObj)
      .filter((item): item is RcFile => Boolean(item));

    if (!files.length) {
      message.warning('请先选择至少一张图片');
      return;
    }

    await uploadMutation.mutateAsync({
      strategyId: values.strategyId,
      files,
    });
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          任务中心
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          当前已打通图片上传任务闭环。摄像头单次任务和定时任务会在下一阶段接入。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={9}>
          <Card title="创建上传任务">
            <Form layout="vertical" form={form} onFinish={handleUploadSubmit}>
              <Form.Item
                label="分析策略"
                name="strategyId"
                rules={[{ required: true, message: '请选择分析策略' }]}
              >
                <Select
                  placeholder="请选择一个启用中的策略"
                  loading={strategyQuery.isLoading}
                  options={strategies.map((item) => ({
                    label: `${item.name} (${item.model_provider}/${item.model_name})`,
                    value: item.id,
                  }))}
                />
              </Form.Item>

              <Form.Item label="上传图片">
                <Dragger
                  multiple
                  accept=".jpg,.jpeg,.png,.bmp,.webp"
                  fileList={fileList}
                  beforeUpload={() => false}
                  onChange={({ fileList: nextFileList }) => setFileList(nextFileList)}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽上传单张/多张图片</p>
                  <p className="ant-upload-hint">支持 JPG、PNG、JPEG、BMP、WEBP</p>
                </Dragger>
              </Form.Item>

              <Space wrap>
                <Button type="primary" htmlType="submit" loading={uploadMutation.isPending}>
                  提交上传任务
                </Button>
                <Button onClick={() => setFileList([])}>清空文件</Button>
              </Space>
            </Form>

            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message="当前范围"
              description="本轮先接入上传任务。摄像头任务和异步 worker 会在下一阶段接入。"
            />
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            title="任务队列"
            extra={
              <Select
                size="small"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '等待中', value: 'queued' },
                  { label: '处理中', value: 'running' },
                  { label: '已完成', value: 'completed' },
                  { label: '失败', value: 'failed' },
                  { label: '已取消', value: 'cancelled' },
                ]}
                style={{ width: 120 }}
              />
            }
          >
            <Table<Job>
              rowKey="id"
              dataSource={jobs}
              loading={jobsQuery.isLoading}
              pagination={{ pageSize: 6 }}
              onRow={(record) => ({
                onClick: () => setSelectedJobId(record.id),
              })}
              columns={[
                {
                  title: '任务 ID',
                  dataIndex: 'id',
                  width: 180,
                  render: (value: string) => <Text code>{value.slice(0, 8)}</Text>,
                },
                {
                  title: '策略',
                  dataIndex: 'strategy_name',
                },
                {
                  title: '类型',
                  dataIndex: 'job_type',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (value: string) => <Tag color={statusColorMap[value] ?? 'default'}>{value}</Tag>,
                },
                {
                  title: '进度',
                  render: (_, record) => `${record.completed_items}/${record.total_items}`,
                },
                {
                  title: '创建时间',
                  dataIndex: 'created_at',
                  render: (value: string | null) => value ? new Date(value).toLocaleString() : '-',
                },
              ]}
            />

            {selectedJob ? (
              <Card size="small" title="任务详情" style={{ marginTop: 16 }}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="任务 ID">{selectedJob.id}</Descriptions.Item>
                  <Descriptions.Item label="策略">
                    {selectedJob.strategy_name} ({selectedJob.strategy_id})
                  </Descriptions.Item>
                  <Descriptions.Item label="模型">
                    {selectedJob.model_provider} / {selectedJob.model_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={statusColorMap[selectedJob.status] ?? 'default'}>{selectedJob.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="完成情况">
                    {selectedJob.completed_items} / {selectedJob.total_items}，失败 {selectedJob.failed_items}
                  </Descriptions.Item>
                  <Descriptions.Item label="错误信息">
                    {selectedJob.error_message || '无'}
                  </Descriptions.Item>
                </Descriptions>

                <Space style={{ marginTop: 12 }}>
                  <Button
                    disabled={['completed', 'failed', 'cancelled'].includes(selectedJob.status)}
                    onClick={() => cancelMutation.mutate(selectedJob.id)}
                    loading={cancelMutation.isPending}
                  >
                    取消任务
                  </Button>
                </Space>
              </Card>
            ) : null}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
