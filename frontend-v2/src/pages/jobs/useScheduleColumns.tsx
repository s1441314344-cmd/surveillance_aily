import { useMemo } from 'react';
import { formatDateTime } from '@/pages/jobs/jobsTableFormatters';
import type { MouseEvent } from 'react';
import { Button, Popconfirm, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import type { Camera, Strategy } from '@/shared/api/configCenter';
import type { JobSchedule } from '@/shared/api/tasks';
import { SCHEDULE_STATUS_LABELS, SCHEDULE_TYPE_LABELS, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const withRowClickGuard =
  (action: () => void) => (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action();
  };

const stopRowClickPropagation = withRowClickGuard(() => undefined);

const getScheduleValueLabel = (scheduleType: string, scheduleValue: string) =>
  scheduleType === 'interval_minutes' ? `${scheduleValue} 分钟` : scheduleValue;

const getNextScheduleStatus = (status: string) => (status === 'active' ? 'paused' : 'active');
const getScheduleToggleButtonLabel = (status: string) => (status === 'active' ? '暂停' : '启用');

const renderLastError = (value: string | null) =>
  value ? <Text type="danger">{value}</Text> : <Text type="secondary">无</Text>;

const renderScheduleStatusBadge = (value: string) => (
  <StatusBadge namespace="schedule" value={value} label={SCHEDULE_STATUS_LABELS[value] ?? UNKNOWN_LABELS.generic} />
);

const buildNameMap = (items: Array<{ id: string; name: string }>) =>
  new Map(items.map((item) => [item.id, item.name]));

const { Text } = Typography;

export type UseScheduleColumnsProps = {
  cameras: Camera[];
  strategies: Strategy[];
  scheduleStatusLoading: boolean;
  runNowLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  onViewJobs: (scheduleId: string) => void;
  onRunNow: (scheduleId: string) => void;
  onEdit: (schedule: JobSchedule) => void;
  onToggleStatus: (scheduleId: string, status: string) => void;
  onDelete: (scheduleId: string) => void;
};

function createScheduleActionsRenderer({
  scheduleStatusLoading,
  runNowLoading,
  updateLoading,
  deleteLoading,
  onViewJobs,
  onRunNow,
  onEdit,
  onToggleStatus,
  onDelete,
}: Omit<UseScheduleColumnsProps, 'cameras' | 'strategies'>): ColumnsType<JobSchedule>[number]['render'] {
  return (_, record) => (
    <Space size={8}>
      <Button
        size="small"
        onClick={withRowClickGuard(() => onViewJobs(record.id))}
      >
        查看任务
      </Button>
      <Button
        size="small"
        onClick={withRowClickGuard(() => onRunNow(record.id))}
        loading={runNowLoading}
      >
        立即执行
      </Button>
      <Button
        size="small"
        onClick={withRowClickGuard(() => onEdit(record))}
        disabled={updateLoading}
      >
        编辑
      </Button>
      <Button
        size="small"
        onClick={withRowClickGuard(() =>
          onToggleStatus(record.id, getNextScheduleStatus(record.status)),
        )}
        loading={scheduleStatusLoading}
      >
        {getScheduleToggleButtonLabel(record.status)}
      </Button>
      <Popconfirm
        title="确认删除该计划吗？"
        description="删除后不会影响已生成的历史任务记录。"
        okText="删除"
        cancelText="取消"
        onConfirm={() => onDelete(record.id)}
      >
        <Button
          size="small"
          danger
          loading={deleteLoading}
          onClick={stopRowClickPropagation}
        >
          删除
        </Button>
      </Popconfirm>
    </Space>
  );
}

function createScheduleColumns(params: {
  cameraNameMap: Map<string, string>;
  strategyNameMap: Map<string, string>;
  renderActions: ColumnsType<JobSchedule>[number]['render'];
}): ColumnsType<JobSchedule> {
  const { cameraNameMap, strategyNameMap, renderActions } = params;
  return [
    {
      title: '计划 ID',
      dataIndex: 'id',
      width: 180,
      render: (value: string) => <Text code>{value.slice(0, 8)}</Text>,
    },
    {
      title: '摄像头',
      dataIndex: 'camera_id',
      render: (value: string) => cameraNameMap.get(value) ?? UNKNOWN_LABELS.camera,
    },
    {
      title: '策略',
      dataIndex: 'strategy_id',
      render: (value: string) => strategyNameMap.get(value) ?? UNKNOWN_LABELS.strategy,
    },
    {
      title: '前置判断',
      dataIndex: 'precheck_strategy_id',
      render: (value: string | null) =>
        value ? strategyNameMap.get(value) ?? UNKNOWN_LABELS.strategy : '无',
    },
    {
      title: '门控参数',
      dataIndex: 'precheck_config',
      render: (value: JobSchedule['precheck_config']) => {
        if (!value) {
          return '-';
        }
        const personThreshold = value.person_threshold ?? 0.5;
        const softNegativeThreshold = value.soft_negative_threshold ?? 0.2;
        const stateTtlSeconds = value.state_ttl_seconds ?? 120;
        return `人≥${personThreshold} / 火漏<${softNegativeThreshold} / TTL=${stateTtlSeconds}s`;
      },
    },
    {
      title: '计划类型',
      dataIndex: 'schedule_type',
      render: (value: string) => SCHEDULE_TYPE_LABELS[value] ?? UNKNOWN_LABELS.generic,
    },
    {
      title: '计划值',
      dataIndex: 'schedule_value',
      render: (value: string, record) => getScheduleValueLabel(record.schedule_type, value),
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
      render: renderLastError,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: renderScheduleStatusBadge,
    },
    {
      title: '操作',
      render: renderActions,
    },
  ];
}

export function useScheduleColumns({
  cameras,
  strategies,
  scheduleStatusLoading,
  runNowLoading,
  updateLoading,
  deleteLoading,
  onViewJobs,
  onRunNow,
  onEdit,
  onToggleStatus,
  onDelete,
}: UseScheduleColumnsProps): ColumnsType<JobSchedule> {
  const cameraNameMap = useMemo(() => buildNameMap(cameras), [cameras]);
  const strategyNameMap = useMemo(() => buildNameMap(strategies), [strategies]);
  const renderActions = useMemo(
    () =>
      createScheduleActionsRenderer({
        scheduleStatusLoading,
        runNowLoading,
        updateLoading,
        deleteLoading,
        onViewJobs,
        onRunNow,
        onEdit,
        onToggleStatus,
        onDelete,
      }),
    [
      scheduleStatusLoading,
      runNowLoading,
      updateLoading,
      deleteLoading,
      onViewJobs,
      onRunNow,
      onEdit,
      onToggleStatus,
      onDelete,
    ],
  );

  return useMemo(
    () =>
      createScheduleColumns({
        cameraNameMap,
        strategyNameMap,
        renderActions,
      }),
    [cameraNameMap, strategyNameMap, renderActions],
  );
}
