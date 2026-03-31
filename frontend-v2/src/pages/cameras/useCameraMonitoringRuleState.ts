import { useCallback, useState } from 'react';
import type { FormInstance } from 'antd';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import {
  type CameraTriggerRule,
  type CameraTriggerRuleDebugResult,
  type DebugLiveResult,
  type SignalMonitorConfig,
} from '@/shared/api/configCenter';
import {
  type MonitorConfigFormValues,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import { useCameraMonitorMutations } from './useCameraMonitorMutations';
import { createTriggerRuleModalActions } from './cameraMonitoringRuleModalActions';
import { createTriggerRuleDebugActions } from './cameraMonitoringRuleDebugActions';
import { createMonitorConfigActions } from './cameraMonitoringConfigActions';
import { useCameraMonitoringFormSync } from './useCameraMonitoringFormSync';

type UseCameraMonitoringRuleStateParams = {
  cameraId: string | null;
  monitorConfig: SignalMonitorConfig | undefined;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  monitorConfigForm: FormInstance<MonitorConfigFormValues>;
};

const DEFAULT_DEBUG_SIGNALS_JSON = '{"person": 0.82, "fire": 0.05, "leak": 0.04}';
const DEFAULT_DEBUG_CONSECUTIVE_JSON = '{"person": 2, "fire": 1, "leak": 1}';

function createDeleteTriggerRuleHandler(
  cameraId: string | null,
  deleteTriggerRuleMutation: ReturnType<typeof useCameraMonitorMutations>['deleteTriggerRuleMutation'],
) {
  return (ruleId: string) => {
    if (!cameraId) {
      return;
    }

    deleteTriggerRuleMutation.mutate({
      targetCameraId: cameraId,
      ruleId,
    });
  };
}

function buildLoadingState(params: {
  createTriggerRuleMutation: ReturnType<typeof useCameraMonitorMutations>['createTriggerRuleMutation'];
  updateTriggerRuleMutation: ReturnType<typeof useCameraMonitorMutations>['updateTriggerRuleMutation'];
  deleteTriggerRuleMutation: ReturnType<typeof useCameraMonitorMutations>['deleteTriggerRuleMutation'];
  debugTriggerRuleMutation: ReturnType<typeof useCameraMonitorMutations>['debugTriggerRuleMutation'];
  saveMonitorConfigMutation: ReturnType<typeof useCameraMonitorMutations>['saveMonitorConfigMutation'];
  toggleMonitorEnabledMutation: ReturnType<typeof useCameraMonitorMutations>['toggleMonitorEnabledMutation'];
  liveDebugMutation: ReturnType<typeof useCameraMonitorMutations>['liveDebugMutation'];
}) {
  const {
    createTriggerRuleMutation,
    updateTriggerRuleMutation,
    deleteTriggerRuleMutation,
    debugTriggerRuleMutation,
    saveMonitorConfigMutation,
    toggleMonitorEnabledMutation,
    liveDebugMutation,
  } = params;

  return {
    createOrUpdateRuleLoading: createTriggerRuleMutation.isPending || updateTriggerRuleMutation.isPending,
    deleteRuleLoading: deleteTriggerRuleMutation.isPending,
    debugRuleLoading: debugTriggerRuleMutation.isPending,
    saveMonitorConfigLoading: saveMonitorConfigMutation.isPending,
    toggleMonitorLoading: toggleMonitorEnabledMutation.isPending,
    liveDebugLoading: liveDebugMutation.isPending,
  };
}

export function useCameraMonitoringRuleState({
  cameraId,
  monitorConfig,
  triggerRuleForm,
  monitorConfigForm,
}: UseCameraMonitoringRuleStateParams) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [triggerRuleModalOpen, setTriggerRuleModalOpen] = useState(false);
  const [editingTriggerRule, setEditingTriggerRule] = useState<CameraTriggerRule | null>(null);
  const [debugSignalsJson, setDebugSignalsJson] = useState(DEFAULT_DEBUG_SIGNALS_JSON);
  const [debugConsecutiveJson, setDebugConsecutiveJson] = useState(DEFAULT_DEBUG_CONSECUTIVE_JSON);
  const [triggerDebugDryRun, setTriggerDebugDryRun] = useState(true);
  const [triggerDebugCaptureOnMatch, setTriggerDebugCaptureOnMatch] = useState(false);
  const [triggerDebugResult, setTriggerDebugResult] = useState<CameraTriggerRuleDebugResult | null>(null);
  const [liveDebugResult, setLiveDebugResult] = useState<DebugLiveResult | null>(null);

  const {
    createTriggerRuleMutation,
    updateTriggerRuleMutation,
    deleteTriggerRuleMutation,
    debugTriggerRuleMutation,
    saveMonitorConfigMutation,
    toggleMonitorEnabledMutation,
    liveDebugMutation,
  } = useCameraMonitorMutations({
    message,
    queryClient,
    triggerRuleForm,
    setTriggerRuleModalOpen,
    setEditingTriggerRule,
    setTriggerDebugResult,
    setLiveDebugResult,
  });

  useCameraMonitoringFormSync({
    cameraId,
    monitorConfig,
    triggerRuleForm,
    monitorConfigForm,
    setEditingTriggerRule,
    setTriggerRuleModalOpen,
    setTriggerDebugResult,
    setLiveDebugResult,
  });

  const {
    openCreateTriggerRuleModal,
    openEditTriggerRuleModal,
    closeTriggerRuleModal,
    handleSubmitTriggerRule,
  } = createTriggerRuleModalActions({
    cameraId,
    message,
    triggerRuleForm,
    editingTriggerRule,
    setTriggerRuleModalOpen,
    setEditingTriggerRule,
    createTriggerRuleMutation,
    updateTriggerRuleMutation,
  });

  const { runTriggerRulesDebug, runLiveDebug } = createTriggerRuleDebugActions({
    cameraId,
    message,
    debugSignalsJson,
    debugConsecutiveJson,
    triggerDebugDryRun,
    triggerDebugCaptureOnMatch,
    debugTriggerRuleMutation,
    liveDebugMutation,
  });

  const deleteTriggerRule = useCallback(
    createDeleteTriggerRuleHandler(cameraId, deleteTriggerRuleMutation),
    [cameraId, deleteTriggerRuleMutation],
  );

  const { submitMonitorConfig, toggleMonitorEnabled } = createMonitorConfigActions({
    cameraId,
    saveMonitorConfigMutation,
    toggleMonitorEnabledMutation,
  });
  const loadingState = buildLoadingState({
    createTriggerRuleMutation,
    updateTriggerRuleMutation,
    deleteTriggerRuleMutation,
    debugTriggerRuleMutation,
    saveMonitorConfigMutation,
    toggleMonitorEnabledMutation,
    liveDebugMutation,
  });
  const debugState = {
    debugSignalsJson,
    setDebugSignalsJson,
    debugConsecutiveJson,
    setDebugConsecutiveJson,
    triggerDebugDryRun,
    setTriggerDebugDryRun,
    triggerDebugCaptureOnMatch,
    setTriggerDebugCaptureOnMatch,
    triggerDebugResult,
    liveDebugResult,
  };

  return {
    triggerRuleModalOpen,
    setTriggerRuleModalOpen,
    editingTriggerRule,
    ...debugState,
    ...loadingState,
    openCreateTriggerRuleModal,
    openEditTriggerRuleModal,
    closeTriggerRuleModal,
    handleSubmitTriggerRule,
    deleteTriggerRule,
    runTriggerRulesDebug,
    runLiveDebug,
    submitMonitorConfig,
    toggleMonitorEnabled,
  };
}
