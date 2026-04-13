import { render, waitFor } from '@testing-library/react';
import type { FormInstance } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import type { SignalMonitorConfig, CameraTriggerRule, CameraTriggerRuleDebugResult, DebugLiveResult } from '@/shared/api/configCenter';
import {
  DEFAULT_MONITOR_CONFIG_VALUES,
  DEFAULT_TRIGGER_RULE_VALUES,
  type MonitorConfigFormValues,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import { useCameraMonitoringFormSync } from '@/pages/cameras/useCameraMonitoringFormSync';

type HarnessProps = {
  cameraId: string | null;
  monitorConfig: SignalMonitorConfig | undefined;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  monitorConfigForm: FormInstance<MonitorConfigFormValues>;
  setEditingTriggerRule: (value: CameraTriggerRule | null) => void;
  setTriggerRuleModalOpen: (value: boolean) => void;
  setTriggerDebugResult: (value: CameraTriggerRuleDebugResult | null) => void;
  setLiveDebugResult: (value: DebugLiveResult | null) => void;
};

function Harness(props: HarnessProps) {
  useCameraMonitoringFormSync(props);
  return null;
}

describe('useCameraMonitoringFormSync', () => {
  it('resets monitoring-related forms and debug state on camera switch', async () => {
    const setTriggerRuleFields = vi.fn();
    const setMonitorConfigFields = vi.fn();
    const triggerRuleForm = { setFieldsValue: setTriggerRuleFields } as unknown as FormInstance<TriggerRuleFormValues>;
    const monitorConfigForm = { setFieldsValue: setMonitorConfigFields } as unknown as FormInstance<MonitorConfigFormValues>;
    const setEditingTriggerRule = vi.fn();
    const setTriggerRuleModalOpen = vi.fn();
    const setTriggerDebugResult = vi.fn();
    const setLiveDebugResult = vi.fn();

    const { rerender } = render(
      <Harness
        cameraId="camera-a"
        monitorConfig={undefined}
        triggerRuleForm={triggerRuleForm}
        monitorConfigForm={monitorConfigForm}
        setEditingTriggerRule={setEditingTriggerRule}
        setTriggerRuleModalOpen={setTriggerRuleModalOpen}
        setTriggerDebugResult={setTriggerDebugResult}
        setLiveDebugResult={setLiveDebugResult}
      />,
    );

    await waitFor(() => expect(setEditingTriggerRule).toHaveBeenCalledTimes(1));
    expect(setEditingTriggerRule).toHaveBeenCalledWith(null);
    expect(setTriggerRuleModalOpen).toHaveBeenCalledWith(false);
    expect(setTriggerDebugResult).toHaveBeenCalledWith(null);
    expect(setLiveDebugResult).toHaveBeenCalledWith(null);
    expect(setTriggerRuleFields).toHaveBeenCalledWith(DEFAULT_TRIGGER_RULE_VALUES);
    expect(setMonitorConfigFields).toHaveBeenCalledWith(DEFAULT_MONITOR_CONFIG_VALUES);

    rerender(
      <Harness
        cameraId="camera-b"
        monitorConfig={undefined}
        triggerRuleForm={triggerRuleForm}
        monitorConfigForm={monitorConfigForm}
        setEditingTriggerRule={setEditingTriggerRule}
        setTriggerRuleModalOpen={setTriggerRuleModalOpen}
        setTriggerDebugResult={setTriggerDebugResult}
        setLiveDebugResult={setLiveDebugResult}
      />,
    );

    await waitFor(() => expect(setEditingTriggerRule).toHaveBeenCalledTimes(2));
    expect(setTriggerRuleFields).toHaveBeenCalledTimes(2);
    expect(setMonitorConfigFields).toHaveBeenCalledTimes(2);
  });

  it('syncs monitor config values into form fields when monitor config is provided', async () => {
    const setTriggerRuleFields = vi.fn();
    const setMonitorConfigFields = vi.fn();
    const triggerRuleForm = { setFieldsValue: setTriggerRuleFields } as unknown as FormInstance<TriggerRuleFormValues>;
    const monitorConfigForm = { setFieldsValue: setMonitorConfigFields } as unknown as FormInstance<MonitorConfigFormValues>;
    const setEditingTriggerRule = vi.fn();
    const setTriggerRuleModalOpen = vi.fn();
    const setTriggerDebugResult = vi.fn();
    const setLiveDebugResult = vi.fn();
    const monitorConfig: SignalMonitorConfig = {
      camera_id: 'camera-a',
      runtime_mode: 'schedule',
      enabled: false,
      signal_strategy_id: null,
      strict_local_gate: false,
      monitor_interval_seconds: 15,
      schedule_type: null,
      schedule_value: null,
      manual_until: null,
      roi_enabled: true,
      roi_x: null,
      roi_y: null,
      roi_width: null,
      roi_height: null,
      roi_shape: 'unknown-shape',
      roi_points: null,
      last_run_at: null,
      next_run_at: null,
      last_error: null,
      created_at: null,
      updated_at: null,
    };

    render(
      <Harness
        cameraId="camera-a"
        monitorConfig={monitorConfig}
        triggerRuleForm={triggerRuleForm}
        monitorConfigForm={monitorConfigForm}
        setEditingTriggerRule={setEditingTriggerRule}
        setTriggerRuleModalOpen={setTriggerRuleModalOpen}
        setTriggerDebugResult={setTriggerDebugResult}
        setLiveDebugResult={setLiveDebugResult}
      />,
    );

    await waitFor(() => expect(setMonitorConfigFields).toHaveBeenCalledTimes(2));
    expect(setTriggerRuleFields).toHaveBeenCalledWith(DEFAULT_TRIGGER_RULE_VALUES);
    expect(setMonitorConfigFields).toHaveBeenNthCalledWith(1, DEFAULT_MONITOR_CONFIG_VALUES);
    expect(setMonitorConfigFields).toHaveBeenLastCalledWith({
      runtime_mode: 'schedule',
      enabled: false,
      signal_strategy_id: undefined,
      strict_local_gate: false,
      monitor_interval_seconds: 15,
      schedule_type: DEFAULT_MONITOR_CONFIG_VALUES.schedule_type,
      schedule_value: '',
      manual_until: '',
      roi_enabled: true,
      roi_x: undefined,
      roi_y: undefined,
      roi_width: undefined,
      roi_height: undefined,
      roi_shape: 'rect',
      roi_points: undefined,
    });
  });

  it('does not re-sync monitor form when polling returns the same config payload', async () => {
    const setTriggerRuleFields = vi.fn();
    const setMonitorConfigFields = vi.fn();
    const triggerRuleForm = { setFieldsValue: setTriggerRuleFields } as unknown as FormInstance<TriggerRuleFormValues>;
    const monitorConfigForm = { setFieldsValue: setMonitorConfigFields } as unknown as FormInstance<MonitorConfigFormValues>;
    const setEditingTriggerRule = vi.fn();
    const setTriggerRuleModalOpen = vi.fn();
    const setTriggerDebugResult = vi.fn();
    const setLiveDebugResult = vi.fn();
    const monitorConfig: SignalMonitorConfig = {
      camera_id: 'camera-a',
      runtime_mode: 'daemon',
      enabled: true,
      signal_strategy_id: 'strategy-1',
      strict_local_gate: true,
      monitor_interval_seconds: 30,
      schedule_type: 'interval_minutes',
      schedule_value: '5',
      manual_until: null,
      roi_enabled: false,
      roi_x: null,
      roi_y: null,
      roi_width: null,
      roi_height: null,
      roi_shape: 'rect',
      roi_points: null,
      last_run_at: null,
      next_run_at: null,
      last_error: null,
      created_at: null,
      updated_at: null,
    };

    const { rerender } = render(
      <Harness
        cameraId="camera-a"
        monitorConfig={monitorConfig}
        triggerRuleForm={triggerRuleForm}
        monitorConfigForm={monitorConfigForm}
        setEditingTriggerRule={setEditingTriggerRule}
        setTriggerRuleModalOpen={setTriggerRuleModalOpen}
        setTriggerDebugResult={setTriggerDebugResult}
        setLiveDebugResult={setLiveDebugResult}
      />,
    );

    await waitFor(() => expect(setMonitorConfigFields).toHaveBeenCalledTimes(2));

    rerender(
      <Harness
        cameraId="camera-a"
        monitorConfig={{ ...monitorConfig }}
        triggerRuleForm={triggerRuleForm}
        monitorConfigForm={monitorConfigForm}
        setEditingTriggerRule={setEditingTriggerRule}
        setTriggerRuleModalOpen={setTriggerRuleModalOpen}
        setTriggerDebugResult={setTriggerDebugResult}
        setLiveDebugResult={setLiveDebugResult}
      />,
    );

    await waitFor(() => expect(setMonitorConfigFields).toHaveBeenCalledTimes(2));
  });
});
