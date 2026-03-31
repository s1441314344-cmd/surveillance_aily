import { Table } from 'antd';
import { type AlertWebhook } from '@/shared/api/configCenter';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import { AlertWebhookCreateForm } from '@/pages/alerts/AlertWebhookCreateForm';
import { type WebhookFormValues } from '@/pages/alerts/types';
import type { FormInstance } from 'antd/es/form';
import type { ColumnsType } from 'antd/es/table';
import type { KeyboardEvent } from 'react';

type AlertWebhooksWorkspaceProps = {
  loading: boolean;
  error: string | null;
  webhooks: AlertWebhook[];
  selectedWebhookId: string | null;
  columns: ColumnsType<AlertWebhook>;
  createForm: FormInstance<WebhookFormValues>;
  createLoading: boolean;
  onCreateWebhook: (values: WebhookFormValues) => void;
  onSelectWebhook: (webhookId: string) => void;
};

function handleWebhookRowKeyboardSelect(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export function AlertWebhooksWorkspace({
  loading,
  error,
  webhooks,
  selectedWebhookId,
  columns,
  createForm,
  createLoading,
  onCreateWebhook,
  onSelectWebhook,
}: AlertWebhooksWorkspaceProps) {
  return (
    <div className="page-grid page-grid--master-detail">
      <SectionCard title="Webhook 列表" subtitle="查看启停状态、推送事件和最近投递情况">
        <DataStateBlock
          loading={loading}
          error={error}
          empty={!loading && !webhooks.length}
          emptyDescription="暂无 Webhook 配置"
        >
          <Table<AlertWebhook>
            rowKey="id"
            dataSource={webhooks}
            columns={columns}
            pagination={{ pageSize: 6, hideOnSinglePage: true }}
            onRow={(record) => ({
              onClick: () => onSelectWebhook(record.id),
              tabIndex: 0,
              'aria-selected': record.id === selectedWebhookId,
              onKeyDown: (event) => handleWebhookRowKeyboardSelect(event, () => onSelectWebhook(record.id)),
            })}
            rowClassName={(record) => `table-row-clickable ${record.id === selectedWebhookId ? 'table-row-selected' : ''}`}
          />
        </DataStateBlock>
      </SectionCard>

      <SectionCard title="新增 Webhook" subtitle="配置告警推送地址、订阅事件和签名密钥">
        <AlertWebhookCreateForm
          form={createForm}
          submitLoading={createLoading}
          onSubmit={onCreateWebhook}
        />
      </SectionCard>
    </div>
  );
}
