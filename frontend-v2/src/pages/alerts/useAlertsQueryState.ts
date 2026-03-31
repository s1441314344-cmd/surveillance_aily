import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type AlertRecord, listAlerts, listAlertWebhooks } from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const ALERTS_REFETCH_INTERVAL_MS = 10000;
const ALERTS_QUERY_KEY_ROOT = 'alerts';
const ALERT_WEBHOOKS_QUERY_KEY = ['alert-webhooks'] as const;

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

  const alerts = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data]);
  const webhooks = useMemo(() => webhooksQuery.data ?? [], [webhooksQuery.data]);

  const alertSummary = buildAlertSummary(alerts);

  const alertsError = getQueryErrorMessage(alertsQuery.error, '告警列表加载失败');
  const webhooksError = getQueryErrorMessage(webhooksQuery.error, 'Webhook 列表加载失败');

  return {
    alertsQuery,
    webhooksQuery,
    alerts,
    webhooks,
    alertSummary,
    alertsError,
    webhooksError,
  };
}
