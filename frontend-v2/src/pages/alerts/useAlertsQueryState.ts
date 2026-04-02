import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type AlertRecord,
  listAlerts,
  listAlertNotificationRoutes,
  listAlertWebhooks,
  listStrategies,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const ALERTS_REFETCH_INTERVAL_MS = 10000;
const ALERTS_QUERY_KEY_ROOT = 'alerts';
const ALERT_WEBHOOKS_QUERY_KEY = ['alert-webhooks'] as const;
const ALERT_NOTIFICATION_ROUTES_QUERY_KEY = ['alert-notification-routes'] as const;
const ALERT_STRATEGIES_QUERY_KEY = ['alert-strategies'] as const;

type UseAlertsQueryStateParams = {
  statusFilter: string;
  severityFilter: string;
  keyword: string;
};

function buildAlertsQueryParams({
  statusFilter,
  severityFilter,
  keyword,
}: UseAlertsQueryStateParams) {
  return {
    status: statusFilter === 'all' ? undefined : statusFilter,
    severity: severityFilter === 'all' ? undefined : severityFilter,
    keyword: keyword.trim() || undefined,
  };
}

function buildAlertSummary(alerts: AlertRecord[]) {
  return {
    total: alerts.length,
    open: alerts.filter((item) => item.status === 'open').length,
    acknowledged: alerts.filter((item) => item.status === 'acknowledged').length,
    resolved: alerts.filter((item) => item.status === 'resolved').length,
  };
}

function getQueryErrorMessage(error: unknown, fallbackMessage: string) {
  return error ? getApiErrorMessage(error, fallbackMessage) : null;
}

export function useAlertsQueryState({
  statusFilter,
  severityFilter,
  keyword,
}: UseAlertsQueryStateParams) {
  const alertsQueryParams = useMemo(
    () => buildAlertsQueryParams({ statusFilter, severityFilter, keyword }),
    [statusFilter, severityFilter, keyword],
  );

  const alertsQuery = useQuery({
    queryKey: [ALERTS_QUERY_KEY_ROOT, statusFilter, severityFilter, keyword],
    queryFn: () => listAlerts(alertsQueryParams),
    refetchInterval: ALERTS_REFETCH_INTERVAL_MS,
  });

  const webhooksQuery = useQuery({
    queryKey: ALERT_WEBHOOKS_QUERY_KEY,
    queryFn: listAlertWebhooks,
  });

  const notificationRoutesQuery = useQuery({
    queryKey: ALERT_NOTIFICATION_ROUTES_QUERY_KEY,
    queryFn: () => listAlertNotificationRoutes(),
    refetchInterval: ALERTS_REFETCH_INTERVAL_MS,
  });

  const strategiesQuery = useQuery({
    queryKey: ALERT_STRATEGIES_QUERY_KEY,
    queryFn: () => listStrategies({ status: 'active' }),
    refetchInterval: ALERTS_REFETCH_INTERVAL_MS * 3,
  });

  const alerts = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data]);
  const webhooks = useMemo(() => webhooksQuery.data ?? [], [webhooksQuery.data]);
  const notificationRoutes = useMemo(
    () => notificationRoutesQuery.data ?? [],
    [notificationRoutesQuery.data],
  );
  const strategies = useMemo(() => strategiesQuery.data ?? [], [strategiesQuery.data]);

  const alertSummary = buildAlertSummary(alerts);

  const alertsError = getQueryErrorMessage(alertsQuery.error, '告警列表加载失败');
  const webhooksError = getQueryErrorMessage(webhooksQuery.error, 'Webhook 列表加载失败');
  const notificationRoutesError = getQueryErrorMessage(notificationRoutesQuery.error, '通知路由列表加载失败');
  const strategiesError = getQueryErrorMessage(strategiesQuery.error, '策略列表加载失败');

  return {
    alertsQuery,
    webhooksQuery,
    notificationRoutesQuery,
    strategiesQuery,
    alerts,
    webhooks,
    notificationRoutes,
    strategies,
    alertSummary,
    alertsError,
    webhooksError,
    notificationRoutesError,
    strategiesError,
  };
}
