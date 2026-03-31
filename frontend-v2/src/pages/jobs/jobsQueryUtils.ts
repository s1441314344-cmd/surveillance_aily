import { buildAllOptions, FILTER_ALL_LABELS, JOB_STATUS_LABELS } from '@/shared/ui';
import type { Camera, Strategy } from '@/shared/api/configCenter';
import type { JobSchedule } from '@/shared/api/tasks';

type Option = { label: string; value: string };

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

export function parseDateFilter(value: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export function optionalFilterValue(value: string) {
  return value === 'all' ? undefined : value;
}

export function getScheduleFilterOptions(schedules: JobSchedule[]): Option[] {
  return buildAllOptions(schedules, FILTER_ALL_LABELS.plan, (item) => ({
      label: `${formatDateTime(item.next_run_at)} · ${item.id.slice(0, 8)}`,
      value: item.id,
    }));
}

export function getJobStatusOptions(): Option[] {
  return buildAllOptions(
    Object.entries(JOB_STATUS_LABELS),
    FILTER_ALL_LABELS.status,
    ([value, label]) => ({ label, value }),
  );
}

export function getStrategyOptions(strategies: Strategy[]): Option[] {
  return buildAllOptions(strategies, FILTER_ALL_LABELS.strategy, (item) => ({
    label: item.name,
    value: item.id,
  }));
}

export function getCameraOptions(cameras: Camera[]): Option[] {
  return buildAllOptions(cameras, FILTER_ALL_LABELS.camera, (item) => ({
    label: item.name,
    value: item.id,
  }));
}
