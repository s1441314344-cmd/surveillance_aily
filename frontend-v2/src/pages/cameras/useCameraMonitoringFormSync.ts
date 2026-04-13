import { useEffect, useRef } from 'react';
import type { FormInstance } from 'antd';
import type { CameraTriggerRule, CameraTriggerRuleDebugResult, DebugLiveResult, SignalMonitorConfig } from '@/shared/api/configCenter';
import {
  DEFAULT_MONITOR_CONFIG_VALUES,
  DEFAULT_TRIGGER_RULE_VALUES,
  type MonitorConfigFormValues,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import {
  buildMonitorConfigSyncKey,
  syncMonitorConfigForm,
} from '@/pages/cameras/cameraMonitoringConfigActions';

type UseCameraMonitoringFormSyncParams = {
  cameraId: string | null;
  monitorConfig: SignalMonitorConfig | undefined;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  monitorConfigForm: FormInstance<MonitorConfigFormValues>;
  setEditingTriggerRule: (value: CameraTriggerRule | null) => void;
  setTriggerRuleModalOpen: (value: boolean) => void;
  setTriggerDebugResult: (value: CameraTriggerRuleDebugResult | null) => void;
  setLiveDebugResult: (value: DebugLiveResult | null) => void;
};

export function useCameraMonitoringFormSync({
  cameraId,
  monitorConfig,
  triggerRuleForm,
  monitorConfigForm,
  setEditingTriggerRule,
  setTriggerRuleModalOpen,
  setTriggerDebugResult,
  setLiveDebugResult,
}: UseCameraMonitoringFormSyncParams) {
  const lastSyncedCameraIdRef = useRef<string | null>(null);
  const lastMonitorConfigSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setEditingTriggerRule(null);
    setTriggerRuleModalOpen(false);
    setTriggerDebugResult(null);
    setLiveDebugResult(null);
    triggerRuleForm.setFieldsValue(DEFAULT_TRIGGER_RULE_VALUES);
    monitorConfigForm.setFieldsValue(DEFAULT_MONITOR_CONFIG_VALUES);
    lastSyncedCameraIdRef.current = cameraId;
    lastMonitorConfigSyncKeyRef.current = null;
  }, [
    cameraId,
    monitorConfigForm,
    setEditingTriggerRule,
    setLiveDebugResult,
    setTriggerDebugResult,
    setTriggerRuleModalOpen,
    triggerRuleForm,
  ]);

  useEffect(() => {
    const nextSyncKey = buildMonitorConfigSyncKey(monitorConfig);
    const sameCamera = lastSyncedCameraIdRef.current === cameraId;
    if (sameCamera && lastMonitorConfigSyncKeyRef.current === nextSyncKey) {
      return;
    }
    syncMonitorConfigForm({ monitorConfig, monitorConfigForm });
    lastSyncedCameraIdRef.current = cameraId;
    lastMonitorConfigSyncKeyRef.current = nextSyncKey;
  }, [cameraId, monitorConfig, monitorConfigForm]);
}
