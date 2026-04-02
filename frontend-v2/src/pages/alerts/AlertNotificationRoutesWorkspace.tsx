import { Table } from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { ColumnsType } from 'antd/es/table';
import type { AlertNotificationRoute } from '@/shared/api/configCenter';
import { DataStateBlock, SectionCard } from '@/shared/ui';
import { AlertNotificationRouteCreateForm } from '@/pages/alerts/AlertNotificationRouteCreateForm';
import type { NotificationRouteFormValues } from '@/pages/alerts/types';
import type { KeyboardEvent } from 'react';

type AlertNotificationRoutesWorkspaceProps = {
  loading: boolean;
  error: string | null;
  routes: AlertNotificationRoute[];
  selectedRouteId: string | null;
  columns: ColumnsType<AlertNotificationRoute>;
  createForm: FormInstance<NotificationRouteFormValues>;
  createLoading: boolean;
  strategyOptions: Array<{ label: string; value: string }>;
  onCreateRoute: (values: NotificationRouteFormValues) => void;
  onSelectRoute: (routeId: string) => void;
};

function handleRowKeyboardSelect(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export function AlertNotificationRoutesWorkspace({
  loading,
  error,
  routes,
  selectedRouteId,
  columns,
  createForm,
  createLoading,
  strategyOptions,
  onCreateRoute,
  onSelectRoute,
}: AlertNotificationRoutesWorkspaceProps) {
  return (
    <div className="page-grid page-grid--master-detail">
      <SectionCard title="通知路由列表" subtitle="按策略/事件/级别匹配并发送到飞书人员或群组">
        <DataStateBlock
          loading={loading}
          error={error}
          empty={!loading && !routes.length}
          emptyDescription="暂无通知路由"
        >
          <Table<AlertNotificationRoute>
            rowKey="id"
            dataSource={routes}
            columns={columns}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            onRow={(record) => ({
              onClick: () => onSelectRoute(record.id),
              tabIndex: 0,
              'aria-selected': record.id === selectedRouteId,
              onKeyDown: (event) => handleRowKeyboardSelect(event, () => onSelectRoute(record.id)),
            })}
            rowClassName={(record) => `table-row-clickable ${record.id === selectedRouteId ? 'table-row-selected' : ''}`}
          />
        </DataStateBlock>
      </SectionCard>

      <SectionCard title="新增通知路由" subtitle="创建策略到飞书接收对象的通知路由">
        <AlertNotificationRouteCreateForm
          form={createForm}
          submitLoading={createLoading}
          strategyOptions={strategyOptions}
          onSubmit={onCreateRoute}
        />
      </SectionCard>
    </div>
  );
}
