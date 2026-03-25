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
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { InboxOutlined } from '@ant-design/icons';
import { listCameras, listStrategies, type Camera, type Strategy } from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import {
  cancelJob,
  createCameraOnceJob,
  createCameraSnapshotUploadJob,
  createJobSchedule,
  deleteJobSchedule,
  getJob,
  Job,
  JobSchedule,
  listJobs,
  listJobSchedules,
  retryJob,
  runJobScheduleNow,
  updateJobSchedule,
  updateJobScheduleStatus,
  uploadJob,
} from '@/shared/api/tasks';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

type UploadFormValues = {
  taskMode: 'upload' | 'camera_once' | 'camera_schedule';
  uploadSource?: 'local_file' | 'camera_snapshot';
  uploadCameraId?: string;
  strategyId: string;
  cameraId?: string;
  scheduleType?: 'interval_minutes' | 'daily_time';
  intervalMinutes?: number;
  dailyTime?: string;
};

type EditScheduleFormValues = {
  scheduleType: 'interval_minutes' | 'daily_time';
  intervalMinutes?: number;
  dailyTime?: string;
};

const DEFAULT_FORM_VALUES: UploadFormValues = {
  taskMode: 'upload',
  uploadSource: 'local_file',
  uploadCameraId: undefined,
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

const triggerModeLabelMap: Record<string, string> = {
  manual: '手动触发',
  schedule: '定时触发',
};
const retryableJobStatus = new Set(['failed', 'cancelled']);
const EMPTY_STRATEGIES: Strategy[] = [];
const EMPTY_CAMERAS: Camera[] = [];
const EMPTY_JOBS: Job[] = [];
const EMPTY_JOB_SCHEDULES: JobSchedule[] = [];

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

function parseDateFilter(value: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) {
    return '-';
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return '-';
  }

  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m ${seconds}s`;
}

export function JobsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<UploadFormValues>();
  const [scheduleEditForm] = Form.useForm<EditScheduleFormValues>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [triggerModeFilter, setTriggerModeFilter] = useState<string>('all');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [createdFromFilter, setCreatedFromFilter] = useState<string>('');
  const [createdToFilter, setCreatedToFilter] = useState<string>('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('all');
  const [scheduleCameraFilter, setScheduleCameraFilter] = useState<string>('all');
  const [scheduleStrategyFilter, setScheduleStrategyFilter] = useState<string>('all');
  const [editScheduleType, setEditScheduleType] = useState<EditScheduleFormValues['scheduleType']>('interval_minutes');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<JobSchedule | null>(null);

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'active'],
    queryFn: () => listStrategies({ status: 'active' }),
  });

  const camerasQuery = useQuery({
    queryKey: ['cameras', 'for-jobs'],
    queryFn: listCameras,
  });

  const jobsQuery = useQuery({
    queryKey: [
      'jobs',
      statusFilter,
      strategyFilter,
      triggerModeFilter,
      cameraFilter,
      scheduleFilter,
      createdFromFilter,
      createdToFilter,
    ],
    queryFn: () =>
      listJobs({
        status: statusFilter === 'all' ? undefined : statusFilter,
        strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
        triggerMode: triggerModeFilter === 'all' ? undefined : triggerModeFilter,
        cameraId: cameraFilter === 'all' ? undefined : cameraFilter,
        scheduleId: scheduleFilter === 'all' ? undefined : scheduleFilter,
        createdFrom: parseDateFilter(createdFromFilter),
        createdTo: parseDateFilter(createdToFilter),
      }),
    refetchInterval: 5000,
  });

  const schedulesQuery = useQuery({
    queryKey: ['job-schedules', scheduleStatusFilter, scheduleCameraFilter, scheduleStrategyFilter],
    queryFn: () =>
      listJobSchedules({
        status: scheduleStatusFilter === 'all' ? undefined : scheduleStatusFilter,
        cameraId: scheduleCameraFilter === 'all' ? undefined : scheduleCameraFilter,
        strategyId: scheduleStrategyFilter === 'all' ? undefined : scheduleStrategyFilter,
      }),
    refetchInterval: 10000,
  });

  const selectedJobQuery = useQuery({
    queryKey: ['job-detail', selectedJobId],
    queryFn: () => getJob(selectedJobId as string),
    enabled: Boolean(selectedJobId),
  });

  const strategies = strategyQuery.data ?? EMPTY_STRATEGIES;
  const cameras = camerasQuery.data ?? EMPTY_CAMERAS;
  const jobs = jobsQuery.data ?? EMPTY_JOBS;
  const schedules = schedulesQuery.data ?? EMPTY_JOB_SCHEDULES;
  const selectedJob = useMemo(() => selectedJobQuery.data ?? null, [selectedJobQuery.data]);
  const taskMode = Form.useWatch('taskMode', form) ?? 'upload';
  const uploadSource = Form.useWatch('uploadSource', form) ?? 'local_file';
  const scheduleType = Form.useWatch('scheduleType', form) ?? 'interval_minutes';
  const selectedCameraIdInForm = Form.useWatch('cameraId', form) ?? undefined;
  const selectedUploadCameraIdInForm = Form.useWatch('uploadCameraId', form) ?? undefined;
  const selectedCameraInForm = useMemo(
    () => cameras.find((item) => item.id === selectedCameraIdInForm) ?? null,
    [cameras, selectedCameraIdInForm],
  );
  const selectedUploadCameraInForm = useMemo(
    () => cameras.find((item) => item.id === selectedUploadCameraIdInForm) ?? null,
    [cameras, selectedUploadCameraIdInForm],
  );
  const hasUnsupportedCameraProtocol =
    taskMode !== 'upload' &&
    Boolean(selectedCameraInForm) &&
    (selectedCameraInForm?.protocol || '').toLowerCase() !== 'rtsp';
  const hasUnsupportedUploadCameraProtocol =
    taskMode === 'upload' &&
    uploadSource === 'camera_snapshot' &&
    Boolean(selectedUploadCameraInForm) &&
    (selectedUploadCameraInForm?.protocol || '').toLowerCase() !== 'rtsp';
  const scheduleFilterOptions = useMemo(
    () => [
      { label: '全部计划', value: 'all' },
      ...schedules.map((item) => ({
        label: `${formatDateTime(item.next_run_at)} · ${item.id.slice(0, 8)}`,
        value: item.id,
      })),
    ],
    [schedules],
  );

  useEffect(() => {
    const selectedStrategyId = form.getFieldValue('strategyId');
    if (!selectedStrategyId && strategies.length > 0) {
      form.setFieldValue('strategyId', strategies[0].id);
    }
  }, [form, strategies]);

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
      message.success('上传任务已进入队列');
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
      message.success('摄像头单次任务已进入队列');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头单次任务创建失败'));
    },
  });

  const cameraSnapshotUploadMutation = useMutation({
    mutationFn: createCameraSnapshotUploadJob,
    onSuccess: async (job) => {
      await invalidateJobs();
      setSelectedJobId(job.id);
      form.setFieldsValue(DEFAULT_FORM_VALUES);
      message.success('摄像头拍照上传任务已进入队列');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '摄像头拍照上传失败'));
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: createJobSchedule,
    onSuccess: async () => {
      await invalidateSchedules();
      form.setFieldsValue({
        taskMode: 'camera_schedule',
        uploadSource: 'local_file',
        uploadCameraId: undefined,
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

  const updateScheduleMutation = useMutation({
    mutationFn: ({ scheduleId, payload }: { scheduleId: string; payload: { scheduleType: string; scheduleValue: string } }) =>
      updateJobSchedule(scheduleId, payload),
    onSuccess: async () => {
      await invalidateSchedules();
      message.success('计划配置已更新');
      setEditingSchedule(null);
      scheduleEditForm.resetFields();
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '计划配置更新失败'));
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: deleteJobSchedule,
    onSuccess: async () => {
      await invalidateSchedules();
      message.success('计划已删除');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '删除计划失败'));
    },
  });

  const runScheduleNowMutation = useMutation({
    mutationFn: runJobScheduleNow,
    onSuccess: async (job) => {
      await Promise.all([invalidateJobs(), invalidateSchedules()]);
      setSelectedJobId(job.id);
      setTriggerModeFilter('schedule');
      setScheduleFilter(job.schedule_id ?? 'all');
      message.success('已按计划立即触发一次任务');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '计划立即执行失败'));
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

  const retryMutation = useMutation({
    mutationFn: retryJob,
    onSuccess: async (job) => {
      await invalidateJobs();
      setSelectedJobId(job.id);
      message.success('已创建重试任务并进入队列');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '重试任务创建失败'));
    },
  });

  const handleUploadSubmit = async (values: UploadFormValues) => {
    if (values.taskMode === 'camera_schedule') {
      if (!values.cameraId) {
        message.warning('请先选择摄像头');
        return;
      }
      if ((selectedCameraInForm?.protocol || '').toLowerCase() !== 'rtsp') {
        message.warning('当前 V1 任务链路仅支持 RTSP 摄像头，ONVIF 为后续扩展能力');
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
      if ((selectedCameraInForm?.protocol || '').toLowerCase() !== 'rtsp') {
        message.warning('当前 V1 任务链路仅支持 RTSP 摄像头，ONVIF 为后续扩展能力');
        return;
      }

      await cameraOnceMutation.mutateAsync({
        cameraId: values.cameraId,
        strategyId: values.strategyId,
      });
      return;
    }

    if (values.uploadSource === 'camera_snapshot') {
      if (!values.uploadCameraId) {
        message.warning('请先选择拍照摄像头');
        return;
      }
      if ((selectedUploadCameraInForm?.protocol || '').toLowerCase() !== 'rtsp') {
        message.warning('当前 V1 仅支持 RTSP 摄像头拍照上传');
        return;
      }

      await cameraSnapshotUploadMutation.mutateAsync({
        cameraId: values.uploadCameraId,
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
      if (uploadSource === 'local_file') {
        setFileList([]);
      }
      form.setFieldValue('uploadCameraId', undefined);
      return;
    }

    form.setFieldValue('cameraId', undefined);
    form.setFieldValue('scheduleType', DEFAULT_FORM_VALUES.scheduleType);
    form.setFieldValue('intervalMinutes', DEFAULT_FORM_VALUES.intervalMinutes);
    form.setFieldValue('dailyTime', DEFAULT_FORM_VALUES.dailyTime);
  };

  const handleFormValuesChange = (changedValues: Partial<UploadFormValues>) => {
    if (changedValues.taskMode) {
      if (changedValues.taskMode !== 'upload') {
        setFileList([]);
      }

      if (changedValues.taskMode === 'upload') {
        form.setFieldsValue({
          uploadSource: 'local_file',
          uploadCameraId: undefined,
          cameraId: undefined,
          scheduleType: DEFAULT_FORM_VALUES.scheduleType,
          intervalMinutes: DEFAULT_FORM_VALUES.intervalMinutes,
          dailyTime: DEFAULT_FORM_VALUES.dailyTime,
        });
        return;
      }

      if (changedValues.taskMode === 'camera_once') {
        form.setFieldsValue({
          uploadSource: 'local_file',
          uploadCameraId: undefined,
          scheduleType: DEFAULT_FORM_VALUES.scheduleType,
          intervalMinutes: DEFAULT_FORM_VALUES.intervalMinutes,
          dailyTime: DEFAULT_FORM_VALUES.dailyTime,
        });
      }
    }

    if (changedValues.uploadSource === 'local_file') {
      form.setFieldValue('uploadCameraId', undefined);
    }

    if (changedValues.uploadSource === 'camera_snapshot') {
      setFileList([]);
    }
  };

  const handleOpenScheduleEditor = (schedule: JobSchedule) => {
    setEditScheduleType(schedule.schedule_type as EditScheduleFormValues['scheduleType']);
    setEditingSchedule(schedule);
    scheduleEditForm.setFieldsValue({
      scheduleType: schedule.schedule_type as EditScheduleFormValues['scheduleType'],
      intervalMinutes:
        schedule.schedule_type === 'interval_minutes' ? Number(schedule.schedule_value || 1) : undefined,
      dailyTime: schedule.schedule_type === 'daily_time' ? schedule.schedule_value : undefined,
    });
  };

  const handleCloseScheduleEditor = () => {
    setEditingSchedule(null);
    setEditScheduleType('interval_minutes');
    scheduleEditForm.resetFields();
  };

  const handleSubmitScheduleEdit = async (values: EditScheduleFormValues) => {
    if (!editingSchedule) {
      return;
    }

    const scheduleValue =
      values.scheduleType === 'daily_time'
        ? values.dailyTime?.trim()
        : String(values.intervalMinutes ?? '').trim();
    if (!scheduleValue) {
      message.warning('请补充完整的计划配置');
      return;
    }

    await updateScheduleMutation.mutateAsync({
      scheduleId: editingSchedule.id,
      payload: {
        scheduleType: values.scheduleType,
        scheduleValue,
      },
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          任务中心
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          图片上传、摄像头单次任务和定时计划已统一进入异步队列，由 worker 执行分析，scheduler 负责触发到期计划。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} lg={9}>
          <Card title="创建任务">
            <Form
              layout="vertical"
              form={form}
              onFinish={handleUploadSubmit}
              onValuesChange={handleFormValuesChange}
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
                <>
                  <Form.Item label="上传来源" name="uploadSource">
                    <Select
                      options={[
                        { label: '本地文件上传', value: 'local_file' },
                        { label: '摄像头拍照上传', value: 'camera_snapshot' },
                      ]}
                    />
                  </Form.Item>

                  {uploadSource === 'local_file' ? (
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
                  ) : (
                    <>
                      <Form.Item
                        label="拍照摄像头"
                        name="uploadCameraId"
                        rules={[{ required: true, message: '请选择拍照摄像头' }]}
                      >
                        <Select
                          placeholder="请选择一个可用摄像头"
                          loading={camerasQuery.isLoading}
                          options={cameras.map((item) => ({
                            label: `${item.name} [${item.protocol.toUpperCase()}] (${item.location || item.rtsp_url || '未配置位置'})`,
                            value: item.id,
                          }))}
                        />
                      </Form.Item>
                      {hasUnsupportedUploadCameraProtocol ? (
                        <Alert
                          type="warning"
                          showIcon
                          style={{ marginBottom: 12 }}
                          title="当前摄像头协议暂不支持"
                          description="V1 拍照上传链路仅支持 RTSP 摄像头。"
                        />
                      ) : null}
                    </>
                  )}
                </>
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
                      label: `${item.name} [${item.protocol.toUpperCase()}] (${item.location || item.rtsp_url || '未配置位置'})`,
                      value: item.id,
                    }))}
                  />
                </Form.Item>
              ) : null}

              {taskMode !== 'upload' && hasUnsupportedCameraProtocol ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  title="当前摄像头协议暂不支持"
                  description="V1 正式任务链路仅支持 RTSP 摄像头，ONVIF 计划在后续版本扩展。"
                />
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
                  disabled={hasUnsupportedCameraProtocol || hasUnsupportedUploadCameraProtocol}
                  loading={
                    uploadMutation.isPending ||
                    cameraOnceMutation.isPending ||
                    cameraSnapshotUploadMutation.isPending ||
                    scheduleMutation.isPending
                  }
                >
                  {taskMode === 'upload'
                    ? uploadSource === 'camera_snapshot'
                      ? '拍照并提交任务'
                      : '提交上传任务'
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
              title="当前范围"
              description={
                taskMode === 'upload'
                  ? uploadSource === 'camera_snapshot'
                    ? '摄像头拍照上传会先执行即时抓帧，再按文件上传同一链路创建 queued 任务并进入异步 worker。'
                    : '上传图片会先保存输入文件并创建 queued 任务，后续由异步 worker 执行分析。'
                  : taskMode === 'camera_once'
                    ? '摄像头单次任务会先进入队列，worker 再按当前 RTSP 配置抓帧并写入记录。'
                    : '定时任务计划支持按分钟间隔和每日固定时间触发，独立 scheduler 会按 next_run_at 生成执行任务。'
              }
            />
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            title="任务队列"
            extra={
              <Space wrap>
                <Select
                  data-testid="jobs-filter-status"
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
                <Select
                  data-testid="jobs-filter-strategy"
                  size="small"
                  value={strategyFilter}
                  onChange={setStrategyFilter}
                  options={[
                    { label: '全部策略', value: 'all' },
                    ...strategies.map((item) => ({
                      label: item.name,
                      value: item.id,
                    })),
                  ]}
                  style={{ width: 160 }}
                />
                <Select
                  data-testid="jobs-filter-trigger"
                  size="small"
                  value={triggerModeFilter}
                  onChange={setTriggerModeFilter}
                  options={[
                    { label: '全部触发', value: 'all' },
                    { label: '手动触发', value: 'manual' },
                    { label: '定时触发', value: 'schedule' },
                  ]}
                  style={{ width: 120 }}
                />
                <Select
                  data-testid="jobs-filter-camera"
                  size="small"
                  value={cameraFilter}
                  onChange={setCameraFilter}
                  options={[
                    { label: '全部摄像头', value: 'all' },
                    ...cameras.map((item) => ({
                      label: item.name,
                      value: item.id,
                    })),
                  ]}
                  style={{ width: 170 }}
                />
                <Select
                  data-testid="jobs-filter-schedule"
                  size="small"
                  value={scheduleFilter}
                  onChange={(value) => {
                    setScheduleFilter(value);
                    if (value !== 'all') {
                      setTriggerModeFilter('schedule');
                    }
                  }}
                  options={scheduleFilterOptions}
                  style={{ width: 190 }}
                />
                <Input
                  size="small"
                  type="datetime-local"
                  value={createdFromFilter}
                  onChange={(event) => setCreatedFromFilter(event.target.value)}
                  style={{ width: 190 }}
                />
                <Input
                  size="small"
                  type="datetime-local"
                  value={createdToFilter}
                  onChange={(event) => setCreatedToFilter(event.target.value)}
                  style={{ width: 190 }}
                />
              </Space>
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
                  title: '模型',
                  render: (_, record) => `${record.model_provider}/${record.model_name}`,
                },
                {
                  title: '类型',
                  dataIndex: 'job_type',
                },
                {
                  title: '触发方式',
                  dataIndex: 'trigger_mode',
                  render: (value: string) => triggerModeLabelMap[value] ?? value,
                },
                {
                  title: '摄像头',
                  dataIndex: 'camera_id',
                  render: (value: string | null) =>
                    value ? (cameras.find((item) => item.id === value)?.name ?? value) : '-',
                },
                {
                  title: '计划',
                  dataIndex: 'schedule_id',
                  render: (value: string | null) => (value ? <Text code>{value.slice(0, 8)}</Text> : '-'),
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
                  render: formatDateTime,
                },
                {
                  title: '耗时',
                  render: (_, record) => formatDuration(record.started_at, record.finished_at),
                },
                {
                  title: '失败原因',
                  dataIndex: 'error_message',
                  width: 220,
                  render: (value: string | null) =>
                    value ? (
                      <Tooltip title={value}>
                        <Text type="danger" ellipsis style={{ maxWidth: 200, display: 'inline-block' }}>
                          {value}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text type="secondary">-</Text>
                    ),
                },
                {
                  title: '操作',
                  width: 120,
                  render: (_, record) =>
                    retryableJobStatus.has(record.status) ? (
                      <Button
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          retryMutation.mutate(record.id);
                        }}
                        loading={retryMutation.isPending}
                      >
                        重试
                      </Button>
                    ) : (
                      <Text type="secondary">-</Text>
                    ),
                },
              ]}
            />

            {selectedJob ? (
              <Card size="small" title="任务详情" style={{ marginTop: 16 }}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="任务 ID">{selectedJob.id}</Descriptions.Item>
                  <Descriptions.Item label="任务类型">{selectedJob.job_type}</Descriptions.Item>
                  <Descriptions.Item label="触发方式">
                    {triggerModeLabelMap[selectedJob.trigger_mode] ?? selectedJob.trigger_mode}
                  </Descriptions.Item>
                  <Descriptions.Item label="策略">
                    {selectedJob.strategy_name} ({selectedJob.strategy_id})
                  </Descriptions.Item>
                  <Descriptions.Item label="摄像头">
                    {selectedJob.camera_id
                      ? (cameras.find((item) => item.id === selectedJob.camera_id)?.name ?? selectedJob.camera_id)
                      : '无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="计划 ID">
                    {selectedJob.schedule_id ? <Text code>{selectedJob.schedule_id}</Text> : '无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="模型">
                    {selectedJob.model_provider} / {selectedJob.model_name}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={statusColorMap[selectedJob.status] ?? 'default'}>{selectedJob.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {formatDateTime(selectedJob.created_at)}
                  </Descriptions.Item>
                  <Descriptions.Item label="开始时间">
                    {formatDateTime(selectedJob.started_at)}
                  </Descriptions.Item>
                  <Descriptions.Item label="完成时间">
                    {formatDateTime(selectedJob.finished_at)}
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
                  <Button
                    disabled={!retryableJobStatus.has(selectedJob.status)}
                    onClick={() => retryMutation.mutate(selectedJob.id)}
                    loading={retryMutation.isPending}
                  >
                    重试任务
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
          <Space wrap>
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
            <Select
              size="small"
              value={scheduleCameraFilter}
              onChange={setScheduleCameraFilter}
              options={[
                { label: '全部摄像头', value: 'all' },
                ...cameras.map((item) => ({
                  label: item.name,
                  value: item.id,
                })),
              ]}
              style={{ width: 170 }}
            />
            <Select
              size="small"
              value={scheduleStrategyFilter}
              onChange={setScheduleStrategyFilter}
              options={[
                { label: '全部策略', value: 'all' },
                ...strategies.map((item) => ({
                  label: item.name,
                  value: item.id,
                })),
              ]}
              style={{ width: 150 }}
            />
          </Space>
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
              render: formatDateTime,
            },
            {
              title: '最近执行',
              dataIndex: 'last_run_at',
              render: formatDateTime,
            },
            {
              title: '最近错误',
              dataIndex: 'last_error',
              render: (value: string | null) =>
                value ? <Text type="danger">{value}</Text> : <Text type="secondary">无</Text>,
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
                <Space size={8}>
                  <Button
                    size="small"
                    onClick={() => {
                      setTriggerModeFilter('schedule');
                      setScheduleFilter(record.id);
                      setSelectedJobId(null);
                    }}
                  >
                    查看任务
                  </Button>
                  <Button
                    size="small"
                    onClick={() => runScheduleNowMutation.mutate(record.id)}
                    loading={runScheduleNowMutation.isPending}
                  >
                    立即执行
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleOpenScheduleEditor(record)}
                    disabled={updateScheduleMutation.isPending}
                  >
                    编辑
                  </Button>
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
                  <Popconfirm
                    title="确认删除该计划吗？"
                    description="删除后不会影响已生成的历史任务记录。"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => deleteScheduleMutation.mutate(record.id)}
                  >
                    <Button
                      size="small"
                      danger
                      loading={deleteScheduleMutation.isPending}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={Boolean(editingSchedule)}
        forceRender
        title="编辑定时计划"
        onCancel={handleCloseScheduleEditor}
        onOk={() => scheduleEditForm.submit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateScheduleMutation.isPending}
      >
        <Form
          form={scheduleEditForm}
          layout="vertical"
          onFinish={handleSubmitScheduleEdit}
          onValuesChange={(changedValues: Partial<EditScheduleFormValues>) => {
            if (changedValues.scheduleType) {
              setEditScheduleType(changedValues.scheduleType);
            }
          }}
          initialValues={{ scheduleType: 'interval_minutes' }}
        >
          <Form.Item
            label="计划类型"
            name="scheduleType"
            rules={[{ required: true, message: '请选择计划类型' }]}
          >
            <Select
              options={[
                { label: '按分钟间隔执行', value: 'interval_minutes' },
                { label: '每日固定时间', value: 'daily_time' },
              ]}
            />
          </Form.Item>

          {editScheduleType === 'interval_minutes' ? (
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
        </Form>
      </Modal>
    </Space>
  );
}
