import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
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
import { listCameras, listStrategies } from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import {
  cancelJob,
  createCameraOnceJob,
  createJobSchedule,
  getJob,
  Job,
  JobSchedule,
  listJobs,
  listJobSchedules,
  updateJobScheduleStatus,
  uploadJob,
} from '@/shared/api/tasks';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

type UploadFormValues = {
  taskMode: 'upload' | 'camera_once' | 'camera_schedule';
  strategyId: string;
  cameraId?: string;
  scheduleType?: 'interval_minutes' | 'daily_time';
  intervalMinutes?: number;
  dailyTime?: string;
};

const DEFAULT_FORM_VALUES: UploadFormValues = {
  taskMode: 'upload',
  strategyId: '',
  cameraId: undefined,
  scheduleType: 'interval_minutes',
  intervalMinutes: 15,
  dailyTime: '08:30',
};

const statusColorMap: Record<string, string> = {
  queued: 'default',
  running: 'processing',
  completed: 'green',
  failed: 'red',
  cancelled: 'orange',
};

const scheduleStatusColorMap: Record<string, string> = {
  active: 'green',
  paused: 'orange',
};

const scheduleTypeLabelMap: Record<string, string> = {
  interval_minutes: '按分钟间隔',
  daily_time: '每日固定时间',
};

export function JobsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UploadFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('all');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'active'],
    queryFn: () => listStrategies({ status: 'active' }),
  });

  const camerasQuery = useQuery({
    queryKey: ['cameras', 'for-jobs'],
    queryFn: listCameras,
  });

  const jobsQuery = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () =>
      listJobs({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    refetchInterval: 5000,
  });

  const schedulesQuery = useQuery({
    queryKey: ['job-schedules', scheduleStatusFilter],
    queryFn: () =>
      listJobSchedules({
        status: scheduleStatusFilter === 'all' ? undefined : scheduleStatusFilter,
      }),
    refetchInterval: 10000,
  });

  const selectedJobQuery = useQuery({
    queryKey: ['job-detail', selectedJobId],
    queryFn: () => getJob(selectedJobId as string),
    enabled: Boolean(selectedJobId),
  });

  const strategies = strategyQuery.data ?? [];
  const cameras = camerasQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const schedules = schedulesQuery.data ?? [];
  const selectedJob = useMemo(() => selectedJobQuery.data ?? null, [selectedJobQuery.data]);
  const taskMode = Form.useWatch('taskMode', form) ?? 'upload';
  const scheduleType = Form.useWatch('scheduleType', form) ?? 'interval_minutes';

  useEffect(() => {
    if (taskMode !== 'upload') {
      setFileList([]);
    }

    if (taskMode === 'upload') {
      form.setFieldValue('cameraId', undefined);
      form.setFieldValue('scheduleType', DEFAULT_FORM_VALUES.scheduleType);
      form.setFieldValue('intervalMinutes', DEFAULT_FORM_VALUES.intervalMinutes);
      form.setFieldValue('dailyTime', DEFAULT_FORM_VALUES.dailyTime);
      return;
    }

    if (taskMode === 'camera_once') {
      form.setFieldValue('scheduleType', DEFAULT_FORM_VALUES.scheduleType);
      form.setFieldValue('intervalMinutes', DEFAULT_FORM_VALUES.intervalMinutes);
      form.setFieldValue('dailyTime', DEFAULT_FORM_VALUES.dailyTime);
    }
  }, [form, taskMode]);

  const invalidateJobs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['job-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['task-records'] }),
    ]);

  const invalidateSchedules = () =>
    queryClient.invalidateQueries({ queryKey: ['job-schedules'] });

  const uploadMutation = useMutation({
    mutationFn: uploadJob,
    onSuccess: async (job) => {
      await invalidateJobs();
      setSelectedJobId(job.id);
      setFileList([]);
      form.setFieldsValue(DEFAULT_FORM_VALUES);
      message.success('上传任务已创建并完成首版分析');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '上传任务创建失败'));
    },
  });

  const cameraOnceMutation = useMutation({
    mutationFn: createCameraOnceJob,
    onSuccess: async (job) => {
      await invalidateJobs();
      setSelectedJobId(job.id);
      form.setFieldsValue(DEFAULT_FORM_VALUES);
      message.success('摄像头单次任务已创建并完成首版分析');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头单次任务创建失败'));
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: createJobSchedule,
    onSuccess: async () => {
      await invalidateSchedules();
      form.setFieldsValue({
        taskMode: 'camera_schedule',
        strategyId: form.getFieldValue('strategyId'),
        cameraId: form.getFieldValue('cameraId'),
        scheduleType: DEFAULT_FORM_VALUES.scheduleType,
        intervalMinutes: DEFAULT_FORM_VALUES.intervalMinutes,
        dailyTime: DEFAULT_FORM_VALUES.dailyTime,
      });
      message.success('定时任务计划已创建');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '定时任务计划创建失败'));
    },
  });

  const scheduleStatusMutation = useMutation({
    mutationFn: ({ scheduleId, status }: { scheduleId: string; status: string }) =>
      updateJobScheduleStatus(scheduleId, status),
    onSuccess: async () => {
      await invalidateSchedules();
      message.success('计划状态已更新');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '计划状态更新失败'));
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
    if (values.taskMode === 'camera_schedule') {
      if (!values.cameraId) {
        message.warning('请先选择摄像头');
        return;
      }

      const scheduleValue =
        values.scheduleType === 'daily_time'
          ? values.dailyTime?.trim()
          : String(values.intervalMinutes ?? '').trim();

      if (!values.scheduleType || !scheduleValue) {
        message.warning('请补充完整的定时任务配置');
        return;
      }

      await scheduleMutation.mutateAsync({
        cameraId: values.cameraId,
        strategyId: values.strategyId,
        scheduleType: values.scheduleType,
        scheduleValue,
      });
      return;
    }

    if (values.taskMode === 'camera_once') {
      if (!values.cameraId) {
        message.warning('请先选择摄像头');
        return;
      }

      await cameraOnceMutation.mutateAsync({
        cameraId: values.cameraId,
        strategyId: values.strategyId,
      });
      return;
    }

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

  const handleResetInput = () => {
    if (taskMode === 'upload') {
      setFileList([]);
      return;
    }

    form.setFieldValue('cameraId', undefined);
    form.setFieldValue('scheduleType', DEFAULT_FORM_VALUES.scheduleType);
    form.setFieldValue('intervalMinutes', DEFAULT_FORM_VALUES.intervalMinutes);
    form.setFieldValue('dailyTime', DEFAULT_FORM_VALUES.dailyTime);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          任务中心
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          当前已支持图片上传、摄像头单次任务和定时任务计划配置。异步 worker 调度会在下一阶段继续收口。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={9}>
          <Card title="创建任务">
            <Form
              layout="vertical"
              form={form}
              onFinish={handleUploadSubmit}
              initialValues={DEFAULT_FORM_VALUES}
            >
              <Form.Item label="任务类型" name="taskMode">
                <Select
                  options={[
                    { label: '图片上传', value: 'upload' },
                    { label: '摄像头单次抽帧', value: 'camera_once' },
                    { label: '摄像头定时任务', value: 'camera_schedule' },
                  ]}
                />
              </Form.Item>

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

              {taskMode === 'upload' ? (
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
              ) : null}

              {taskMode !== 'upload' ? (
                <Form.Item
                  label="选择摄像头"
                  name="cameraId"
                  rules={[{ required: true, message: '请选择摄像头' }]}
                >
                  <Select
                    placeholder="请选择一个可用摄像头"
                    loading={camerasQuery.isLoading}
                    options={cameras.map((item) => ({
                      label: `${item.name} (${item.location || item.rtsp_url || '未配置位置'})`,
                      value: item.id,
                    }))}
                  />
                </Form.Item>
              ) : null}

              {taskMode === 'camera_schedule' ? (
                <>
                  <Form.Item label="计划类型" name="scheduleType" rules={[{ required: true, message: '请选择计划类型' }]}>
                    <Select
                      options={[
                        { label: '按分钟间隔执行', value: 'interval_minutes' },
                        { label: '每日固定时间', value: 'daily_time' },
                      ]}
                    />
                  </Form.Item>

                  {scheduleType === 'interval_minutes' ? (
                    <Form.Item
                      label="执行间隔(分钟)"
                      name="intervalMinutes"
                      rules={[{ required: true, message: '请输入执行间隔' }]}
                    >
                      <Input type="number" min={1} placeholder="例如 15" />
                    </Form.Item>
                  ) : (
                    <Form.Item
                      label="每日执行时间"
                      name="dailyTime"
                      rules={[{ required: true, message: '请输入每日执行时间' }]}
                    >
                      <Input placeholder="例如 08:30" />
                    </Form.Item>
                  )}
                </>
              ) : null}

              <Space wrap>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={
                    uploadMutation.isPending || cameraOnceMutation.isPending || scheduleMutation.isPending
                  }
                >
                  {taskMode === 'upload'
                    ? '提交上传任务'
                    : taskMode === 'camera_once'
                      ? '执行摄像头单次任务'
                      : '创建定时任务计划'}
                </Button>
                <Button onClick={handleResetInput}>
                  {taskMode === 'upload' ? '清空文件' : '清空当前配置'}
                </Button>
              </Space>
            </Form>

            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message="当前范围"
              description={
                taskMode === 'upload'
                  ? '上传任务会立即落库并生成任务记录。'
                  : taskMode === 'camera_once'
                    ? '摄像头单次任务会按当前 RTSP 配置抓取一帧并生成记录。'
                    : '定时任务计划当前支持按分钟间隔和每日固定时间两种模式，可统一在计划列表中启停。'
              }
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

      <Card
        title="定时任务计划"
        extra={
          <Select
            size="small"
            value={scheduleStatusFilter}
            onChange={setScheduleStatusFilter}
            options={[
              { label: '全部计划', value: 'all' },
              { label: '启用中', value: 'active' },
              { label: '已暂停', value: 'paused' },
            ]}
            style={{ width: 120 }}
          />
        }
      >
        <Table<JobSchedule>
          rowKey="id"
          dataSource={schedules}
          loading={schedulesQuery.isLoading}
          pagination={{ pageSize: 6 }}
          locale={{ emptyText: '暂无定时任务计划' }}
          columns={[
            {
              title: '计划 ID',
              dataIndex: 'id',
              width: 180,
              render: (value: string) => <Text code>{value.slice(0, 8)}</Text>,
            },
            {
              title: '摄像头',
              dataIndex: 'camera_id',
              render: (value: string) =>
                cameras.find((item) => item.id === value)?.name ?? value,
            },
            {
              title: '策略',
              dataIndex: 'strategy_id',
              render: (value: string) =>
                strategies.find((item) => item.id === value)?.name ?? value,
            },
            {
              title: '计划类型',
              dataIndex: 'schedule_type',
              render: (value: string) => scheduleTypeLabelMap[value] ?? value,
            },
            {
              title: '计划值',
              dataIndex: 'schedule_value',
              render: (value: string, record) =>
                record.schedule_type === 'interval_minutes' ? `${value} 分钟` : value,
            },
            {
              title: '下次执行',
              dataIndex: 'next_run_at',
              render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value: string) => (
                <Tag color={scheduleStatusColorMap[value] ?? 'default'}>{value}</Tag>
              ),
            },
            {
              title: '操作',
              render: (_, record) => (
                <Button
                  size="small"
                  onClick={() =>
                    scheduleStatusMutation.mutate({
                      scheduleId: record.id,
                      status: record.status === 'active' ? 'paused' : 'active',
                    })
                  }
                  loading={scheduleStatusMutation.isPending}
                >
                  {record.status === 'active' ? '暂停' : '启用'}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
