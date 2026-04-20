import {
  buildAllOptions,
  createAllOption,
  FILTER_ALL_LABELS,
  JOB_STATUS_LABELS,
  SCHEDULE_STATUS_OPTIONS,
} from '@/shared/ui';
import type { Camera } from '@/shared/api/cameras';
import type { Strategy } from '@/shared/api/strategies';
import type { JobSchedule } from '@/shared/api/jobs';
import { formatDateTime } from '@/pages/jobs/jobsTableFormatters';
import type { OptionItem } from '@/pages/jobs/jobsOptionItem';

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

export function getScheduleFilterOptions(schedules: JobSchedule[]): OptionItem[] {
  return buildAllOptions(schedules, FILTER_ALL_LABELS.plan, (item) => ({
      label: `${formatDateTime(item.next_run_at)} · ${item.id.slice(0, 8)}`,
      value: item.id,
    }));
}

export function getJobStatusOptions(): OptionItem[] {
  return buildAllOptions(
    Object.entries(JOB_STATUS_LABELS),
    FILTER_ALL_LABELS.status,
    ([value, label]) => ({ label, value }),
  );
}

export function getScheduleStatusFilterOptions(): OptionItem[] {
  return [createAllOption(FILTER_ALL_LABELS.status), ...SCHEDULE_STATUS_OPTIONS];
}

export function getStrategyOptions(strategies: Strategy[]): OptionItem[] {
  return buildAllOptions(strategies, FILTER_ALL_LABELS.strategy, (item) => ({
    label: item.name,
    value: item.id,
  }));
}

export function getStrategySelectOptions(strategies: Strategy[]): OptionItem[] {
  return strategies.map((item) => ({
    label: `${item.name} (${item.model_provider}/${item.model_name})`,
    value: item.id,
  }));
}

export function getCameraOptions(cameras: Camera[]): OptionItem[] {
  return buildAllOptions(cameras, FILTER_ALL_LABELS.camera, (item) => ({
    label: item.name,
    value: item.id,
  }));
}

export function getCameraSelectOptions(cameras: Camera[]): OptionItem[] {
  return cameras.map((item) => ({
    label: `${item.name} [${item.protocol.toUpperCase()}] (${item.location || item.rtsp_url || '未配置位置'})`,
    value: item.id,
  }));
}
