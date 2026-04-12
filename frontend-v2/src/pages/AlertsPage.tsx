import { useMemo } from 'react';
import { Tabs } from 'antd';
import { PageHeader } from '@/shared/ui';
import { AlertEventsTab } from '@/pages/alerts/AlertEventsTab';
import { AlertNotificationRouteEditModal } from '@/pages/alerts/AlertNotificationRouteEditModal';
import { AlertNotificationRoutesWorkspace } from '@/pages/alerts/AlertNotificationRoutesWorkspace';
import { AlertSummaryBadges } from '@/pages/alerts/AlertSummaryBadges';
import { AlertWebhookEditModal } from '@/pages/alerts/AlertWebhookEditModal';
import { AlertWebhooksWorkspace } from '@/pages/alerts/AlertWebhooksWorkspace';
import { useAlertsPageController } from '@/pages/alerts/useAlertsPageController';

export function AlertsPage() {
  const {
    createForm,
    updateForm,
    selectedAlertId,
    setSelectedAlertId,
    selectedWebhookId,
    setSelectedWebhookId,
    selectedNotificationRouteId,
    setSelectedNotificationRouteId,
    filters,
    queries,
    mutations,
    formState,
    notificationRouteFormState,
    columns,
    notificationRouteColumns,
    notificationCreateForm,
    notificationUpdateForm,
    handleResetEventFilters,
  } = useAlertsPageController();
  const strategyOptions = useMemo(
    () =>
      queries.strategies.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [queries.strategies],
  );
  const tabsItems = useMemo(
    () => [
      {
        key: 'events',
        label: '告警事件',
        children: (
          <AlertEventsTab
            statusFilter={filters.statusFilter}
            severityFilter={filters.severityFilter}
            keyword={filters.keyword}
            loading={queries.alertsQuery.isLoading}
            error={queries.alertsError}
            alerts={queries.alerts}
            selectedAlertId={selectedAlertId}
            alertColumns={columns.alertColumns}
            onStatusFilterChange={filters.setStatusFilter}
            onSeverityFilterChange={filters.setSeverityFilter}
            onKeywordChange={filters.setKeyword}
            onReset={handleResetEventFilters}
            onSelectAlert={setSelectedAlertId}
          />
        ),
      },
      {
        key: 'webhooks',
        label: 'Webhook 管理',
        children: (
          <AlertWebhooksWorkspace
            loading={queries.webhooksQuery.isLoading}
            error={queries.webhooksError}
            webhooks={queries.webhooks}
            selectedWebhookId={selectedWebhookId}
            columns={columns.webhookColumns}
            createForm={createForm}
            createLoading={mutations.createWebhookMutation.isPending}
            onCreateWebhook={formState.handleCreateWebhook}
            onSelectWebhook={setSelectedWebhookId}
          />
        ),
      },
      {
        key: 'notification-routes',
        label: '通知路由（飞书）',
        children: (
          <AlertNotificationRoutesWorkspace
            loading={queries.notificationRoutesQuery.isLoading || queries.strategiesQuery.isLoading}
            error={queries.notificationRoutesError || queries.strategiesError}
            routes={queries.notificationRoutes}
            selectedRouteId={selectedNotificationRouteId}
            columns={notificationRouteColumns}
            createForm={notificationCreateForm}
            createLoading={mutations.createNotificationRouteMutation.isPending}
            strategyOptions={strategyOptions}
            onCreateRoute={notificationRouteFormState.handleCreateNotificationRoute}
            onSelectRoute={setSelectedNotificationRouteId}
          />
        ),
      },
    ],
    [
      filters.statusFilter,
      filters.severityFilter,
      filters.keyword,
      filters.setStatusFilter,
      filters.setSeverityFilter,
      filters.setKeyword,
      queries.alertsQuery.isLoading,
      queries.alertsError,
      queries.alerts,
      queries.webhooksQuery.isLoading,
      queries.webhooksError,
      queries.webhooks,
      queries.notificationRoutesQuery.isLoading,
      queries.notificationRoutesError,
      queries.notificationRoutes,
      queries.strategiesQuery.isLoading,
      queries.strategiesError,
      selectedAlertId,
      selectedWebhookId,
      selectedNotificationRouteId,
      columns.alertColumns,
      columns.webhookColumns,
      notificationRouteColumns,
      handleResetEventFilters,
      setSelectedAlertId,
      setSelectedWebhookId,
      setSelectedNotificationRouteId,
      createForm,
      notificationCreateForm,
      formState.handleCreateWebhook,
      notificationRouteFormState.handleCreateNotificationRoute,
      mutations.createWebhookMutation.isPending,
      mutations.createNotificationRouteMutation.isPending,
      strategyOptions,
    ],
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="告警协同"
        title="告警中心"
        description="统一查看监测告警、处理状态，并维护 Webhook 推送配置。"
        extra={(
          <AlertSummaryBadges
            total={queries.alertSummary.total}
            open={queries.alertSummary.open}
            acknowledged={queries.alertSummary.acknowledged}
            resolved={queries.alertSummary.resolved}
          />
        )}
      />

      <Tabs
        className="workspace-tabs"
        type="card"
        items={tabsItems}
      />

      <AlertWebhookEditModal
        form={updateForm}
        open={Boolean(formState.editingWebhook)}
        confirmLoading={mutations.updateWebhookMutation.isPending}
        onCancel={formState.closeWebhookEditor}
        onSubmit={formState.handleUpdateWebhook}
      />

      <AlertNotificationRouteEditModal
        form={notificationUpdateForm}
        open={Boolean(notificationRouteFormState.editingRoute)}
        confirmLoading={mutations.updateNotificationRouteMutation.isPending}
        strategyOptions={strategyOptions}
        onCancel={notificationRouteFormState.closeNotificationRouteEditor}
        onSubmit={notificationRouteFormState.handleUpdateNotificationRoute}
      />
    </div>
  );
}
