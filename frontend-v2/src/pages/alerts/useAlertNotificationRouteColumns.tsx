import { useMemo } from 'react';
import { Button, Space, Switch, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AlertNotificationRoute } from '@/shared/api/configCenter';
import {
  ALERT_SEVERITY_LABELS,
  GENERIC_STATE_LABELS,
  StatusBadge,
} from '@/shared/ui';
import type { useAlertsMutationState } from '@/pages/alerts/useAlertsMutationState';

const { Text } = Typography;

type UseAlertNotificationRouteColumnsParams = {
  updateNotificationRouteMutation: ReturnType<typeof useAlertsMutationState>['updateNotificationRouteMutation'];
  openNotificationRouteEditor: (route: AlertNotificationRoute) => void;
};

function getRecipientTypeLabel(value: string) {
  if (value === 'user') {
    return '人员';
  }
  if (value === 'chat') {
    return '群组';
  }
  return value || '-';
}

export function useAlertNotificationRouteColumns({
  updateNotificationRouteMutation,
  openNotificationRouteEditor,
}: UseAlertNotificationRouteColumnsParams) {
  return useMemo<ColumnsType<AlertNotificationRoute>>(
    () => [
      {
        title: '路由',
        key: 'route',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{record.name}</Text>
            <Text type="secondary">{record.id}</Text>
          </Space>
        ),
      },
      {
        title: '匹配条件',
        key: 'match',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text>策略：{record.strategy_name || record.strategy_id || '全部'}</Text>
            <Text type="secondary">
              事件：{record.event_key || '全部'} / 级别：{record.severity ? (ALERT_SEVERITY_LABELS[record.severity] || record.severity) : '全部'}
            </Text>
            <Text type="secondary">摄像头：{record.camera_id || '全部'}</Text>
          </Space>
        ),
      },
      {
        title: '接收对象',
        key: 'recipient',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text>{getRecipientTypeLabel(record.recipient_type)}</Text>
            <Text type="secondary">{record.recipient_id}</Text>
          </Space>
        ),
      },
      {
        title: '状态',
        key: 'status',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <StatusBadge
              namespace="generic"
              value={record.enabled ? 'enabled' : 'disabled'}
              label={record.enabled ? GENERIC_STATE_LABELS.enabled : GENERIC_STATE_LABELS.disabled}
            />
            <Text type="secondary">
              最近成功：{record.last_delivered_at ? new Date(record.last_delivered_at).toLocaleString() : '暂无'}
            </Text>
            <Text type="secondary">{record.last_error || '最近无错误'}</Text>
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 170,
        render: (_, record) => (
          <Space wrap>
            <Switch
              checked={record.enabled}
              onClick={(_, event) => event.stopPropagation()}
              onChange={(checked) => {
                updateNotificationRouteMutation.mutate({
                  routeId: record.id,
                  payload: { enabled: checked },
                });
              }}
            />
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                openNotificationRouteEditor(record);
              }}
            >
              编辑
            </Button>
          </Space>
        ),
      },
    ],
    [openNotificationRouteEditor, updateNotificationRouteMutation],
  );
}
