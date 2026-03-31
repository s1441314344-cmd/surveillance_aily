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
      monitor_interval_seconds: number;
      schedule_type: 'interval_minutes' | 'daily_time' | null;
      schedule_value: string | null;
      manual_until: string | null;
    };
  }) => Promise<unknown>;
};

export const buildMonitorConfigPayload = (values: MonitorConfigFormValues) => ({
  runtime_mode: values.runtime_mode,
  enabled: values.enabled,
  signal_strategy_id: values.signal_strategy_id?.trim() || null,
  monitor_interval_seconds: Number(values.monitor_interval_seconds),
  schedule_type: values.runtime_mode === 'schedule' ? values.schedule_type ?? 'interval_minutes' : null,
  schedule_value:
    values.runtime_mode === 'schedule'
      ? values.schedule_value?.trim() || (values.schedule_type === 'daily_time' ? '00:00' : '1')
      : null,
  manual_until: values.runtime_mode === 'manual' ? values.manual_until?.trim() || null : null,
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
    monitor_interval_seconds: monitorConfig.monitor_interval_seconds,
    schedule_type: monitorConfig.schedule_type ?? DEFAULT_MONITOR_CONFIG_VALUES.schedule_type,
    schedule_value: monitorConfig.schedule_value ?? '',
    manual_until: monitorConfig.manual_until ?? '',
  });
};
