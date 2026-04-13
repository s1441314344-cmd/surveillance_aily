import type { SignalMonitorConfig } from '@/shared/api/configCenter';
import {
  type MonitorConfigFormValues,
  DEFAULT_MONITOR_CONFIG_VALUES,
} from '@/pages/cameras/cameraCenterConfig';

type SaveMonitorConfigMutation = {
  mutateAsync: (params: {
    targetCameraId: string;
    payload: {
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
  }) => Promise<unknown>;
};

export const buildMonitorConfigPayload = (values: MonitorConfigFormValues) => ({
  roi_enabled: Boolean(values.roi_enabled),
  roi_shape: (values.roi_shape === 'polygon' ? 'polygon' : 'rect') as 'rect' | 'polygon',
  runtime_mode: values.runtime_mode,
  enabled: values.enabled,
  signal_strategy_id: values.signal_strategy_id?.trim() || null,
  strict_local_gate: Boolean(values.strict_local_gate),
  monitor_interval_seconds: Number(values.monitor_interval_seconds),
  schedule_type: values.runtime_mode === 'schedule' ? values.schedule_type ?? 'interval_minutes' : null,
  schedule_value:
    values.runtime_mode === 'schedule'
      ? values.schedule_value?.trim() || (values.schedule_type === 'daily_time' ? '00:00' : '1')
      : null,
  manual_until: values.runtime_mode === 'manual' ? values.manual_until?.trim() || null : null,
  // ROI shape 按单一来源传递：polygon 仅 points，rect 仅 x/y/width/height
  roi_x: values.roi_enabled && values.roi_shape !== 'polygon' ? Number(values.roi_x ?? 0.05) : null,
  roi_y: values.roi_enabled && values.roi_shape !== 'polygon' ? Number(values.roi_y ?? 0.05) : null,
  roi_width: values.roi_enabled && values.roi_shape !== 'polygon' ? Number(values.roi_width ?? 0.9) : null,
  roi_height: values.roi_enabled && values.roi_shape !== 'polygon' ? Number(values.roi_height ?? 0.9) : null,
  roi_points:
    values.roi_enabled && values.roi_shape === 'polygon' && Array.isArray(values.roi_points)
      ? values.roi_points.map((item) => ({
          x: Number(item.x),
          y: Number(item.y),
        }))
      : null,
});

type CreateMonitorConfigActionsParams = {
  cameraId: string | null;
  saveMonitorConfigMutation: SaveMonitorConfigMutation;
  toggleMonitorEnabledMutation: { mutate: (params: { targetCameraId: string; enabled: boolean }) => void };
};

export const createMonitorConfigActions = ({
  cameraId,
  saveMonitorConfigMutation,
  toggleMonitorEnabledMutation,
}: CreateMonitorConfigActionsParams) => {
  const submitMonitorConfig = async (values: MonitorConfigFormValues) => {
    if (!cameraId) {
      return;
    }

    await saveMonitorConfigMutation.mutateAsync({
      targetCameraId: cameraId,
      payload: buildMonitorConfigPayload(values),
    });
  };

  const toggleMonitorEnabled = (enabled: boolean) => {
    if (!cameraId) {
      return;
    }
    toggleMonitorEnabledMutation.mutate({
      targetCameraId: cameraId,
      enabled,
    });
  };

  return {
    submitMonitorConfig,
    toggleMonitorEnabled,
  };
};

type UseSyncMonitorConfigFormParams = {
  monitorConfig: SignalMonitorConfig | undefined;
  monitorConfigForm: {
    setFieldsValue: (values: Partial<MonitorConfigFormValues>) => void;
  };
};

export const syncMonitorConfigForm = ({
  monitorConfig,
  monitorConfigForm,
}: UseSyncMonitorConfigFormParams) => {
  if (!monitorConfig) {
    return;
  }

  monitorConfigForm.setFieldsValue({
    runtime_mode: monitorConfig.runtime_mode,
    enabled: monitorConfig.enabled,
    signal_strategy_id: monitorConfig.signal_strategy_id ?? undefined,
    strict_local_gate: monitorConfig.strict_local_gate,
    monitor_interval_seconds: monitorConfig.monitor_interval_seconds,
    schedule_type: monitorConfig.schedule_type ?? DEFAULT_MONITOR_CONFIG_VALUES.schedule_type,
    schedule_value: monitorConfig.schedule_value ?? '',
    manual_until: monitorConfig.manual_until ?? '',
    roi_enabled: monitorConfig.roi_enabled ?? false,
    roi_x: monitorConfig.roi_x ?? undefined,
    roi_y: monitorConfig.roi_y ?? undefined,
    roi_width: monitorConfig.roi_width ?? undefined,
    roi_height: monitorConfig.roi_height ?? undefined,
    roi_shape: monitorConfig.roi_shape === 'polygon' ? 'polygon' : 'rect',
    roi_points: monitorConfig.roi_points ?? undefined,
  });
};

export const buildMonitorConfigSyncKey = (monitorConfig: SignalMonitorConfig | undefined): string | null => {
  if (!monitorConfig) {
    return null;
  }

  return JSON.stringify({
    runtime_mode: monitorConfig.runtime_mode,
    enabled: Boolean(monitorConfig.enabled),
    signal_strategy_id: monitorConfig.signal_strategy_id ?? null,
    strict_local_gate: Boolean(monitorConfig.strict_local_gate),
    monitor_interval_seconds: Number(monitorConfig.monitor_interval_seconds),
    schedule_type: monitorConfig.schedule_type ?? DEFAULT_MONITOR_CONFIG_VALUES.schedule_type,
    schedule_value: monitorConfig.schedule_value ?? '',
    manual_until: monitorConfig.manual_until ?? '',
    roi_enabled: Boolean(monitorConfig.roi_enabled),
    roi_x: monitorConfig.roi_x ?? null,
    roi_y: monitorConfig.roi_y ?? null,
    roi_width: monitorConfig.roi_width ?? null,
    roi_height: monitorConfig.roi_height ?? null,
    roi_shape: monitorConfig.roi_shape === 'polygon' ? 'polygon' : 'rect',
    roi_points: Array.isArray(monitorConfig.roi_points)
      ? monitorConfig.roi_points.map((item) => ({
          x: Number(item.x),
          y: Number(item.y),
        }))
      : null,
  });
};
