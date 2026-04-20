import type { QueryKey } from '@tanstack/react-query';
import type {
  CameraTriggerRuleDebugResult,
} from '@/shared/api/cameras';
import type { TriggerRuleFormValues } from '@/pages/cameras/cameraCenterConfig';
import { CAMERA_QUERY_KEYS } from '@/pages/cameras/cameraQueryKeys';

export type TriggerRuleDebugPayload = {
  signals: Record<string, number>;
  consecutive_hits: Record<string, number>;
  dry_run: boolean;
  capture_on_match: boolean;
  source_kind: string;
};

export type MonitorConfigMutationPayload = {
  runtime_mode: 'daemon' | 'manual' | 'schedule';
  enabled: boolean;
  signal_strategy_id: string | null;
  strict_local_gate: boolean;
  monitor_interval_seconds: number;
  schedule_type: 'interval_minutes' | 'daily_time' | null;
  schedule_value: string | null;
  manual_until: string | null;
  roi_enabled: boolean;
  roi_x: number | null;
  roi_y: number | null;
  roi_width: number | null;
  roi_height: number | null;
  roi_shape: 'rect' | 'polygon';
  roi_points: Array<{ x: number; y: number }> | null;
};

export type LiveDebugMutationPayload = {
  detected_signals: Record<string, number>;
  source_kind: string;
  include_results: boolean;
};

export const normalizeTriggerRulePayload = (payload: TriggerRuleFormValues) => ({
  ...payload,
  event_key: payload.event_type === 'custom' ? payload.event_key?.trim() || undefined : payload.event_type,
  description: payload.description?.trim() || undefined,
});

export const getTriggerRuleDebugInvalidateKeys = (
  result: CameraTriggerRuleDebugResult,
): QueryKey[] => {
  const keysToInvalidate: QueryKey[] = [CAMERA_QUERY_KEYS.cameraTriggerRulesRoot];
  if (result.capture_on_match && result.matched_count > 0) {
    keysToInvalidate.unshift(CAMERA_QUERY_KEYS.cameraMediaRoot);
  }
  return keysToInvalidate;
};

export const getTriggerRuleDebugSuccessMessage = (matchedCount: number) =>
  matchedCount > 0
    ? `任务已进入队列，命中 ${matchedCount} 条规则`
    : '自动监测中，当前暂无命中';

export const getMonitorConfigSuccessMessage = (enabled: boolean, mode: 'save' | 'toggle') => {
  if (enabled) {
    return '自动监测中，任务已进入队列';
  }
  return mode === 'toggle' ? '自动监测已暂停' : '监测配置已保存';
};

export const getLiveDebugSuccessMessage = (matchedCount: number) =>
  matchedCount > 0
    ? `任务已进入队列，实时调试命中 ${matchedCount} 条`
    : '自动监测中，实时调试暂无命中';
