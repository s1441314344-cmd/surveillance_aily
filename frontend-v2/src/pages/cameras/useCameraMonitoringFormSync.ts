import { useEffect } from 'react';
import type { FormInstance } from 'antd';
import type { CameraTriggerRule, CameraTriggerRuleDebugResult, DebugLiveResult, SignalMonitorConfig } from '@/shared/api/configCenter';
import {
  DEFAULT_MONITOR_CONFIG_VALUES,
  DEFAULT_TRIGGER_RULE_VALUES,
  type MonitorConfigFormValues,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import { syncMonitorConfigForm } from '@/pages/cameras/cameraMonitoringConfigActions';

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
  useEffect(() => {
    setEditingTriggerRule(null);
    setTriggerRuleModalOpen(false);
    setTriggerDebugResult(null);
    setLiveDebugResult(null);
    triggerRuleForm.setFieldsValue(DEFAULT_TRIGGER_RULE_VALUES);
    monitorConfigForm.setFieldsValue(DEFAULT_MONITOR_CONFIG_VALUES);
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
    syncMonitorConfigForm({ monitorConfig, monitorConfigForm });
  }, [monitorConfig, monitorConfigForm]);
}
