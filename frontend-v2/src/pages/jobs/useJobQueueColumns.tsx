import { Button, Space, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import type { Camera } from '@/shared/api/cameras';
import type { Job } from '@/shared/api/jobs';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS, StatusBadge, TRIGGER_MODE_LABELS, UNKNOWN_LABELS } from '@/shared/ui';
import { useMemo } from 'react';
import { formatDateTime, formatDuration } from '@/pages/jobs/jobsTableFormatters';
import { withRowClickGuard } from '@/pages/jobs/jobsTableEventGuards';
import { buildLookupNameMap } from '@/pages/jobs/jobsTableLookups';

const { Text } = Typography;

const retryableJobStatus = new Set(['failed', 'cancelled']);
const terminalJobStatus = new Set(['completed', 'failed', 'cancelled']);

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

export type UseJobQueueColumnsLookupsProps = {
  cameras: Camera[];
};

export type UseJobQueueColumnsActionsLoadingProps = {
  cancelLoading: boolean;
  retryLoading: boolean;
};

export type UseJobQueueColumnsActionsHandlersProps = {
  onCancelJob: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
};

export type UseJobQueueColumnsActionsProps = {
  loading: UseJobQueueColumnsActionsLoadingProps;
  handlers: UseJobQueueColumnsActionsHandlersProps;
};

export type UseJobQueueColumnsProps = {
  lookups: UseJobQueueColumnsLookupsProps;
  actions: UseJobQueueColumnsActionsProps;
};

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
  loading: { cancelLoading, retryLoading },
  handlers: { onCancelJob, onRetryJob },
}: UseJobQueueColumnsActionsProps): ColumnsType<Job>[number]['render'] {
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
  lookups: { cameras },
  actions,
}: UseJobQueueColumnsProps): ColumnsType<Job> {
  const cameraNameMap = useMemo(() => buildLookupNameMap(cameras), [cameras]);
  const renderActions = useMemo(
    () => createJobActionsRenderer(actions),
    [actions],
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
