import { useMemo } from 'react';
import { Button, Space, Switch, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AlertWebhook } from '@/shared/api/configCenter';
import {
  GENERIC_STATE_LABELS,
  StatusBadge,
  WEBHOOK_EVENT_LABELS,
} from '@/shared/ui';
import type { UseAlertsTableColumnsParams } from '@/pages/alerts/useAlertsTableColumns.types';
import type { MouseEvent } from 'react';

const { Text } = Typography;

type WebhookColumnsParams = Pick<UseAlertsTableColumnsParams, 'updateWebhookMutation' | 'openWebhookEditor'>;

const withRowClickGuard =
  (action: () => void) => (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action();
  };

export function useAlertWebhookColumns({
  updateWebhookMutation,
  openWebhookEditor,
}: WebhookColumnsParams) {
  return useMemo<ColumnsType<AlertWebhook>>(
    () => [
      {
        title: 'Webhook',
        key: 'webhook',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text strong>{record.name}</Text>
            <Text type="secondary">{record.endpoint}</Text>
          </Space>
        ),
      },
      {
        title: '事件',
        dataIndex: 'events',
        render: (events: string[]) => (
          <Space wrap size={[0, 8]}>
            {events?.length ? (
              events.map((eventName) => (
                <StatusBadge
                  key={eventName}
                  namespace="generic"
                  value="info"
                  label={WEBHOOK_EVENT_LABELS[eventName] ?? eventName}
                />
              ))
            ) : (
              <Text type="secondary">默认</Text>
            )}
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 110,
        render: (enabled: boolean) => (
          <StatusBadge
            namespace="generic"
            value={enabled ? 'enabled' : 'disabled'}
            label={enabled ? GENERIC_STATE_LABELS.enabled : GENERIC_STATE_LABELS.disabled}
          />
        ),
      },
      {
        title: '投递情况',
        key: 'delivery',
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text type="secondary">
              {record.last_delivered_at
                ? `最近成功: ${new Date(record.last_delivered_at).toLocaleString()}`
                : '暂无成功投递'}
            </Text>
            <Text type="secondary">{record.last_error || '最近无错误'}</Text>
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 150,
        render: (_, record) => (
          <Space wrap>
            <Switch
              checked={record.enabled}
              onClick={(_, event) => event.stopPropagation()}
              onChange={(checked) => {
                updateWebhookMutation.mutate({
                  webhookId: record.id,
                  payload: { enabled: checked },
                });
              }}
            />
            <Button
              size="small"
              onClick={withRowClickGuard(() => openWebhookEditor(record))}
            >
              编辑
            </Button>
          </Space>
        ),
      },
    ],
    [openWebhookEditor, updateWebhookMutation],
  );
}
