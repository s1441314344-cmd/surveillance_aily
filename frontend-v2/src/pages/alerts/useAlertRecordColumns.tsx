import { useMemo } from 'react';
import { Button, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AlertRecord } from '@/shared/api/configCenter';
import {
  ALERT_SEVERITY_LABELS,
  ALERT_STATUS_LABELS,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import type { UseAlertsTableColumnsParams } from '@/pages/alerts/useAlertsTableColumns.types';
import type { MouseEvent } from 'react';

const { Text } = Typography;

type AlertColumnsParams = Pick<UseAlertsTableColumnsParams, 'ackMutation' | 'resolveMutation'>;

const withRowClickGuard =
  (action: () => void) => (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action();
  };

const canAckAlert = (status: string) => status !== 'acknowledged' && status !== 'resolved';
const canResolveAlert = (status: string) => status !== 'resolved';

export function useAlertRecordColumns({ ackMutation, resolveMutation }: AlertColumnsParams) {
  return useMemo<ColumnsType<AlertRecord>>(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
      },
      {
        title: '来源',
        key: 'camera',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text>{record.camera_name || UNKNOWN_LABELS.camera}</Text>
            <Text type="secondary">{record.camera_id || '-'}</Text>
          </Space>
        ),
      },
      {
        title: '级别',
        dataIndex: 'severity',
        width: 100,
        render: (value: string) => (
          <StatusBadge
            namespace="alertSeverity"
            value={value}
            label={ALERT_SEVERITY_LABELS[value] ?? UNKNOWN_LABELS.generic}
          />
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (value: string) => (
          <StatusBadge namespace="alertStatus" value={value} label={ALERT_STATUS_LABELS[value] ?? UNKNOWN_LABELS.generic} />
        ),
      },
      {
        title: '告警内容',
        key: 'message',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{record.title}</Text>
            <Text type="secondary">{record.message || '无详情'}</Text>
            {record.matched_count !== null ? (
              <Text type="secondary">命中次数: {record.matched_count}</Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 190,
        render: (_, record) => (
          <Space wrap>
            <Button
              size="small"
              disabled={!canAckAlert(record.status)}
              loading={ackMutation.isPending}
              onClick={withRowClickGuard(() => ackMutation.mutate(record.id))}
            >
              确认告警
            </Button>
            <Button
              size="small"
              type="primary"
              disabled={!canResolveAlert(record.status)}
              loading={resolveMutation.isPending}
              onClick={withRowClickGuard(() => resolveMutation.mutate(record.id))}
            >
              标记已处理
            </Button>
          </Space>
        ),
      },
    ],
    [ackMutation, resolveMutation],
  );
}
