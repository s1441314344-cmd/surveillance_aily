import { useMemo } from 'react';
import { Tabs } from 'antd';
import { AlertEventsTab } from '@/pages/alerts/AlertEventsTab';
import { AlertNotificationRoutesWorkspace } from '@/pages/alerts/AlertNotificationRoutesWorkspace';
import { AlertWebhooksWorkspace } from '@/pages/alerts/AlertWebhooksWorkspace';
import type { useAlertsPageController } from '@/pages/alerts/useAlertsPageController';

type AlertsPageController = ReturnType<typeof useAlertsPageController>;

type AlertsTabsWorkspaceProps = {
  controller: AlertsPageController;
};

export function AlertsTabsWorkspace({ controller }: AlertsTabsWorkspaceProps) {
  const strategyOptions = useMemo(
    () =>
      controller.queries.strategies.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [controller.queries.strategies],
  );

  const tabsItems = useMemo(
    () => [
      {
        key: 'events',
        label: '告警事件',
        children: (
          <AlertEventsTab
            statusFilter={controller.filters.statusFilter}
            severityFilter={controller.filters.severityFilter}
            keyword={controller.filters.keyword}
            loading={controller.queries.alertsQuery.isLoading}
            error={controller.queries.alertsError}
            alerts={controller.queries.alerts}
            selectedAlertId={controller.selectedAlertId}
            alertColumns={controller.columns.alertColumns}
            onStatusFilterChange={controller.filters.setStatusFilter}
            onSeverityFilterChange={controller.filters.setSeverityFilter}
            onKeywordChange={controller.filters.setKeyword}
            onReset={controller.handleResetEventFilters}
            onSelectAlert={controller.setSelectedAlertId}
          />
        ),
      },
      {
        key: 'webhooks',
        label: 'Webhook 管理',
        children: (
          <AlertWebhooksWorkspace
            loading={controller.queries.webhooksQuery.isLoading}
            error={controller.queries.webhooksError}
            webhooks={controller.queries.webhooks}
            selectedWebhookId={controller.selectedWebhookId}
            columns={controller.columns.webhookColumns}
            createForm={controller.createForm}
            createLoading={controller.mutations.createWebhookMutation.isPending}
            onCreateWebhook={controller.formState.handleCreateWebhook}
            onSelectWebhook={controller.setSelectedWebhookId}
          />
        ),
      },
      {
        key: 'notification-routes',
        label: '通知路由（飞书）',
        children: (
          <AlertNotificationRoutesWorkspace
            loading={controller.queries.notificationRoutesQuery.isLoading || controller.queries.strategiesQuery.isLoading}
            error={controller.queries.notificationRoutesError || controller.queries.strategiesError}
            routes={controller.queries.notificationRoutes}
            selectedRouteId={controller.selectedNotificationRouteId}
            columns={controller.notificationRouteColumns}
            createForm={controller.notificationCreateForm}
            createLoading={controller.mutations.createNotificationRouteMutation.isPending}
            strategyOptions={strategyOptions}
            onCreateRoute={controller.notificationRouteFormState.handleCreateNotificationRoute}
            onSelectRoute={controller.setSelectedNotificationRouteId}
          />
        ),
      },
    ],
    [
      controller.columns.alertColumns,
      controller.columns.webhookColumns,
      controller.createForm,
      controller.filters.keyword,
      controller.filters.setKeyword,
      controller.filters.setSeverityFilter,
      controller.filters.setStatusFilter,
      controller.filters.severityFilter,
      controller.filters.statusFilter,
      controller.formState.handleCreateWebhook,
      controller.handleResetEventFilters,
      controller.mutations.createNotificationRouteMutation.isPending,
      controller.mutations.createWebhookMutation.isPending,
      controller.notificationCreateForm,
      controller.notificationRouteColumns,
      controller.notificationRouteFormState.handleCreateNotificationRoute,
      controller.queries.alerts,
      controller.queries.alertsError,
      controller.queries.alertsQuery.isLoading,
      controller.queries.notificationRoutes,
      controller.queries.notificationRoutesError,
      controller.queries.notificationRoutesQuery.isLoading,
      controller.queries.strategiesError,
      controller.queries.strategiesQuery.isLoading,
      controller.queries.webhooks,
      controller.queries.webhooksError,
      controller.queries.webhooksQuery.isLoading,
      controller.selectedAlertId,
      controller.selectedNotificationRouteId,
      controller.selectedWebhookId,
      controller.setSelectedAlertId,
      controller.setSelectedNotificationRouteId,
      controller.setSelectedWebhookId,
      strategyOptions,
    ],
  );

  return (
    <Tabs
      className="workspace-tabs"
      type="card"
      items={tabsItems}
    />
  );
}
