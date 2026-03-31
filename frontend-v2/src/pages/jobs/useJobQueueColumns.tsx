import { Button, Space, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import type { Camera } from '@/shared/api/configCenter';
import type { Job } from '@/shared/api/tasks';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS, StatusBadge, TRIGGER_MODE_LABELS, UNKNOWN_LABELS } from '@/shared/ui';
import { useMemo } from 'react';
import { formatDateTime, formatDuration } from '@/pages/jobs/jobsTableFormatters';
import type { MouseEvent } from 'react';

const { Text } = Typography;

const retryableJobStatus = new Set(['failed', 'cancelled']);
const terminalJobStatus = new Set(['completed', 'failed', 'cancelled']);

const withRowClickGuard =
  (action: () => void) => (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action();
  };

const renderJobStatus = (value: string) => (
  <StatusBadge namespace="job" value={value} label={JOB_STATUS_LABELS[value] ?? UNKNOWN_LABELS.generic} />
);

const renderTerminalActionPlaceholder = (status: string) =>
  !retryableJobStatus.has(status) && terminalJobStatus.has(status) ? <Text type="secondary">-</Text> : null;

function createJobColumns(params: {
  cameraNameMap: Map<string, string>;
  renderActions: ColumnsType<Job>[number]['render'];
}): ColumnsType<Job> {
  const { cameraNameMap, renderActions } = params;
  return [
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
      render: (_, record) => renderJobModel(record),
    },
    {
      title: '类型',
      dataIndex: 'job_type',
      render: (value: string) => JOB_TYPE_LABELS[value] ?? UNKNOWN_LABELS.generic,
    },
    {
      title: '触发方式',
      dataIndex: 'trigger_mode',
      render: (value: string) => TRIGGER_MODE_LABELS[value] ?? UNKNOWN_LABELS.generic,
    },
    {
      title: '摄像头',
      dataIndex: 'camera_id',
      render: (value: string | null) => renderJobCamera(value, cameraNameMap),
    },
    {
      title: '计划',
      dataIndex: 'schedule_id',
      render: renderJobSchedule,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: renderJobStatus,
    },
    {
      title: '进度',
      render: (_, record) => renderJobProgress(record),
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
      render: renderJobError,
    },
    {
      title: '操作',
      width: 170,
      render: renderActions,
    },
  ];
}

export type UseJobQueueColumnsProps = {
  cameras: Camera[];
  cancelLoading: boolean;
  retryLoading: boolean;
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
};

function buildCameraNameMap(cameras: Camera[]) {
  return new Map(cameras.map((camera) => [camera.id, camera.name]));
}

function renderJobModel(record: Job) {
  return `${record.model_provider || UNKNOWN_LABELS.provider} / ${record.model_name || UNKNOWN_LABELS.model}`;
}

function renderJobCamera(value: string | null, cameraNameMap: Map<string, string>) {
  return value ? cameraNameMap.get(value) ?? UNKNOWN_LABELS.camera : '-';
}

function renderJobSchedule(value: string | null) {
  return value ? <Text code>{value.slice(0, 8)}</Text> : '-';
}

function renderJobProgress(record: Job) {
  return `${record.completed_items}/${record.total_items}`;
}

function renderJobError(value: string | null) {
  return value ? (
    <Tooltip title={value}>
      <span className="jobs-error-text">{value}</span>
    </Tooltip>
  ) : (
    <Text type="secondary">-</Text>
  );
}

function createJobActionsRenderer({
  cancelLoading,
  retryLoading,
  onCancelJob,
  onRetryJob,
}: Omit<UseJobQueueColumnsProps, 'cameras'>): ColumnsType<Job>[number]['render'] {
  return (_, record) => (
    <Space size={6}>
      {!terminalJobStatus.has(record.status) ? (
        <Button
          size="small"
          onClick={withRowClickGuard(() => onCancelJob(record.id))}
          loading={cancelLoading}
        >
          取消
        </Button>
      ) : null}
      {retryableJobStatus.has(record.status) ? (
        <Button
          size="small"
          onClick={withRowClickGuard(() => onRetryJob(record.id))}
          loading={retryLoading}
        >
          重试
        </Button>
      ) : null}
      {renderTerminalActionPlaceholder(record.status)}
    </Space>
  );
}

export function useJobQueueColumns({
  cameras,
  cancelLoading,
  retryLoading,
  onCancelJob,
  onRetryJob,
}: UseJobQueueColumnsProps): ColumnsType<Job> {
  const cameraNameMap = useMemo(() => buildCameraNameMap(cameras), [cameras]);
  const renderActions = useMemo(
    () => createJobActionsRenderer({ cancelLoading, retryLoading, onCancelJob, onRetryJob }),
    [cancelLoading, retryLoading, onCancelJob, onRetryJob],
  );

  return useMemo(
    () =>
      createJobColumns({
        cameraNameMap,
        renderActions,
      }),
    [cameraNameMap, renderActions],
  );
}
