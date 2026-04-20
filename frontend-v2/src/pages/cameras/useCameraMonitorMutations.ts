import { useMutation } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

import {
  type CameraTriggerRule,
  type CameraTriggerRuleDebugResult,
  type DebugLiveResult,
  type SignalMonitorConfigPayload,
  createCameraTriggerRule,
  debugCameraLive,
  debugCameraTriggerRules,
  deleteCameraTriggerRule,
  updateCameraTriggerRule,
  updateSignalMonitorConfig,
} from '@/shared/api/cameras';
import {
  DEFAULT_TRIGGER_RULE_VALUES,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import { CAMERA_QUERY_KEYS } from '@/pages/cameras/cameraQueryKeys';
import {
  getTriggerRuleDebugInvalidateKeys,
  getTriggerRuleDebugSuccessMessage,
  getMonitorConfigSuccessMessage,
  getLiveDebugSuccessMessage,
  type LiveDebugMutationPayload,
  type MonitorConfigMutationPayload,
  normalizeTriggerRulePayload,
  type TriggerRuleDebugPayload,
} from '@/pages/cameras/cameraMonitorMutationUtils';
import {
  createApiErrorHandler,
  invalidateQueryKeys,
} from '@/pages/cameras/cameraMutationHelpers';

type UseCameraMonitorMutationsParams = {
  message: MessageInstance;
  queryClient: QueryClient;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  setTriggerRuleModalOpen: Dispatch<SetStateAction<boolean>>;
  setEditingTriggerRule: Dispatch<SetStateAction<CameraTriggerRule | null>>;
  setTriggerDebugResult: Dispatch<SetStateAction<CameraTriggerRuleDebugResult | null>>;
  setLiveDebugResult: Dispatch<SetStateAction<DebugLiveResult | null>>;
};

type TriggerRuleMutationPayload = {
  targetCameraId: string;
  payload: TriggerRuleFormValues;
};

type TriggerRuleUpdateMutationPayload = TriggerRuleMutationPayload & {
  ruleId: string;
};

type TriggerRuleDeleteMutationPayload = {
  targetCameraId: string;
  ruleId: string;
};

type TriggerRuleDebugMutationPayload = {
  targetCameraId: string;
  payload: TriggerRuleDebugPayload;
};

type MonitorConfigMutationArgs = {
  targetCameraId: string;
  payload: MonitorConfigMutationPayload;
};

type ToggleMonitorMutationArgs = {
  targetCameraId: string;
  enabled: boolean;
};

type LiveDebugMutationArgs = {
  targetCameraId: string;
  payload: LiveDebugMutationPayload;
};

type MonitorConfigMutationSuccessMode = 'save' | 'toggle';

const TRIGGER_RULE_INVALIDATE_KEYS = [CAMERA_QUERY_KEYS.cameraTriggerRulesRoot] as const;
const MONITOR_CONFIG_INVALIDATE_KEYS = [CAMERA_QUERY_KEYS.cameraSignalMonitorConfigRoot] as const;

function createMonitorMutationErrorHandlers(message: MessageInstance) {
  return {
    triggerRuleCreateError: createApiErrorHandler(message, '触发规则创建失败'),
    triggerRuleUpdateError: createApiErrorHandler(message, '触发规则更新失败'),
    triggerRuleDeleteError: createApiErrorHandler(message, '触发规则删除失败'),
    triggerRuleDebugError: createApiErrorHandler(message, '规则调试失败'),
    monitorConfigSaveError: createApiErrorHandler(message, '监测配置保存失败'),
    monitorToggleError: createApiErrorHandler(message, '监测状态更新失败'),
    liveDebugError: createApiErrorHandler(message, '实时调试失败'),
  };
}

type TriggerRuleMutationHandlers = {
  invalidateTriggerRules: () => Promise<void>;
  handleTriggerRuleMutationSuccess: (successMessage: string, resetForm?: boolean) => Promise<void>;
  handleTriggerRuleDebugSuccess: (result: CameraTriggerRuleDebugResult) => Promise<void>;
};

type MonitorConfigMutationHandlers = {
  handleMonitorConfigMutationSuccess: (
    enabled: boolean,
    mode: MonitorConfigMutationSuccessMode,
  ) => Promise<void>;
  handleLiveDebugSuccess: (result: DebugLiveResult) => void;
};

function createMatchedResultNotifier(message: MessageInstance) {
  return (matchedCount: number, getMessage: (count: number) => string) => {
    const content = getMessage(matchedCount);
    if (matchedCount > 0) {
      message.success(content);
      return;
    }
    message.info(content);
  };
}

function createTriggerRuleMutationHandlers(params: {
  message: MessageInstance;
  queryClient: QueryClient;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  setTriggerRuleModalOpen: Dispatch<SetStateAction<boolean>>;
  setEditingTriggerRule: Dispatch<SetStateAction<CameraTriggerRule | null>>;
  setTriggerDebugResult: Dispatch<SetStateAction<CameraTriggerRuleDebugResult | null>>;
}): TriggerRuleMutationHandlers {
  const {
    message,
    queryClient,
    triggerRuleForm,
    setTriggerRuleModalOpen,
    setEditingTriggerRule,
    setTriggerDebugResult,
  } = params;
  const notifyMatchedResult = createMatchedResultNotifier(message);

  const invalidateTriggerRules = async () => {
    await invalidateQueryKeys(queryClient, [...TRIGGER_RULE_INVALIDATE_KEYS]);
  };
  const closeRuleModal = () => {
    setTriggerRuleModalOpen(false);
    setEditingTriggerRule(null);
  };

  const handleTriggerRuleMutationSuccess = async (successMessage: string, resetForm = false) => {
    await invalidateTriggerRules();
    closeRuleModal();
    if (resetForm) {
      triggerRuleForm.setFieldsValue(DEFAULT_TRIGGER_RULE_VALUES);
    }
    message.success(successMessage);
  };
  const handleTriggerRuleDebugSuccess = async (result: CameraTriggerRuleDebugResult) => {
    setTriggerDebugResult(result);
    notifyMatchedResult(result.matched_count, getTriggerRuleDebugSuccessMessage);
    const keysToInvalidate: QueryKey[] = getTriggerRuleDebugInvalidateKeys(result);
    await invalidateQueryKeys(queryClient, keysToInvalidate);
  };

  return {
    invalidateTriggerRules,
    handleTriggerRuleMutationSuccess,
    handleTriggerRuleDebugSuccess,
  };
}

function createMonitorConfigMutationHandlers(params: {
  message: MessageInstance;
  queryClient: QueryClient;
  setLiveDebugResult: Dispatch<SetStateAction<DebugLiveResult | null>>;
}): MonitorConfigMutationHandlers {
  const { message, queryClient, setLiveDebugResult } = params;
  const notifyMatchedResult = createMatchedResultNotifier(message);

  const invalidateMonitorConfig = async () => {
    await invalidateQueryKeys(queryClient, [...MONITOR_CONFIG_INVALIDATE_KEYS]);
  };

  const handleMonitorConfigMutationSuccess = async (
    enabled: boolean,
    mode: MonitorConfigMutationSuccessMode,
  ) => {
    await invalidateMonitorConfig();
    message.success(getMonitorConfigSuccessMessage(enabled, mode));
  };
  const handleLiveDebugSuccess = (result: DebugLiveResult) => {
    setLiveDebugResult(result);
    notifyMatchedResult(result.matched_count, getLiveDebugSuccessMessage);
  };

  return {
    handleMonitorConfigMutationSuccess,
    handleLiveDebugSuccess,
  };
}

function createRuleMutationSuccessHandler(params: {
  handleTriggerRuleMutationSuccess: (successMessage: string, resetForm?: boolean) => Promise<void>;
  successMessage: string;
  resetForm?: boolean;
}) {
  const { handleTriggerRuleMutationSuccess, successMessage, resetForm = false } = params;
  return async () => {
    await handleTriggerRuleMutationSuccess(successMessage, resetForm);
  };
}

function createTriggerRuleMutationFn() {
  return ({ targetCameraId, payload }: TriggerRuleMutationPayload) =>
    createCameraTriggerRule(targetCameraId, normalizeTriggerRulePayload(payload));
}

function createTriggerRuleUpdateMutationFn() {
  return ({ targetCameraId, ruleId, payload }: TriggerRuleUpdateMutationPayload) =>
    updateCameraTriggerRule(targetCameraId, ruleId, normalizeTriggerRulePayload(payload));
}

function createMonitorConfigSuccessHandler(params: {
  handleMonitorConfigMutationSuccess: (
    enabled: boolean,
    mode: MonitorConfigMutationSuccessMode,
  ) => Promise<void>;
  mode: MonitorConfigMutationSuccessMode;
}) {
  const { handleMonitorConfigMutationSuccess, mode } = params;
  return async (config: { enabled: boolean }) => {
    await handleMonitorConfigMutationSuccess(config.enabled, mode);
  };
}

function createMonitorConfigMutationFn(
  args: MonitorConfigMutationArgs,
) {
  return updateSignalMonitorConfig(args.targetCameraId, args.payload);
}

function createToggleMonitorConfigMutationFn(args: ToggleMonitorMutationArgs) {
  const payload: SignalMonitorConfigPayload = {
    enabled: args.enabled,
  };
  return updateSignalMonitorConfig(args.targetCameraId, payload);
}

export function useCameraMonitorMutations({
  message,
  queryClient,
  triggerRuleForm,
  setTriggerRuleModalOpen,
  setEditingTriggerRule,
  setTriggerDebugResult,
  setLiveDebugResult,
}: UseCameraMonitorMutationsParams) {
  const { invalidateTriggerRules, handleTriggerRuleMutationSuccess, handleTriggerRuleDebugSuccess } =
    createTriggerRuleMutationHandlers({
      message,
      queryClient,
      triggerRuleForm,
      setTriggerRuleModalOpen,
      setEditingTriggerRule,
      setTriggerDebugResult,
    });
  const { handleMonitorConfigMutationSuccess, handleLiveDebugSuccess } =
    createMonitorConfigMutationHandlers({
      message,
      queryClient,
      setLiveDebugResult,
    });
  const errorHandlers = createMonitorMutationErrorHandlers(message);

  const createTriggerRuleMutation = useMutation({
    mutationFn: createTriggerRuleMutationFn(),
    onSuccess: createRuleMutationSuccessHandler({
      handleTriggerRuleMutationSuccess,
      successMessage: '触发规则已创建',
      resetForm: true,
    }),
    onError: errorHandlers.triggerRuleCreateError,
  });

  const updateTriggerRuleMutation = useMutation({
    mutationFn: createTriggerRuleUpdateMutationFn(),
    onSuccess: createRuleMutationSuccessHandler({
      handleTriggerRuleMutationSuccess,
      successMessage: '触发规则已更新',
    }),
    onError: errorHandlers.triggerRuleUpdateError,
  });

  const deleteTriggerRuleMutation = useMutation({
    mutationFn: ({ targetCameraId, ruleId }: TriggerRuleDeleteMutationPayload) =>
      deleteCameraTriggerRule(targetCameraId, ruleId),
    onSuccess: async () => {
      await invalidateTriggerRules();
      message.success('触发规则已删除');
    },
    onError: errorHandlers.triggerRuleDeleteError,
  });

  const debugTriggerRuleMutation = useMutation({
    mutationFn: ({ targetCameraId, payload }: TriggerRuleDebugMutationPayload) =>
      debugCameraTriggerRules(targetCameraId, payload),
    onSuccess: handleTriggerRuleDebugSuccess,
    onError: errorHandlers.triggerRuleDebugError,
  });

  const saveMonitorConfigMutation = useMutation({
    mutationFn: createMonitorConfigMutationFn,
    onSuccess: createMonitorConfigSuccessHandler({
      handleMonitorConfigMutationSuccess,
      mode: 'save',
    }),
    onError: errorHandlers.monitorConfigSaveError,
  });

  const toggleMonitorEnabledMutation = useMutation({
    mutationFn: createToggleMonitorConfigMutationFn,
    onSuccess: createMonitorConfigSuccessHandler({
      handleMonitorConfigMutationSuccess,
      mode: 'toggle',
    }),
    onError: errorHandlers.monitorToggleError,
  });

  const liveDebugMutation = useMutation({
    mutationFn: ({ targetCameraId, payload }: LiveDebugMutationArgs) =>
      debugCameraLive(targetCameraId, payload),
    onSuccess: handleLiveDebugSuccess,
    onError: errorHandlers.liveDebugError,
  });

  return {
    createTriggerRuleMutation,
    updateTriggerRuleMutation,
    deleteTriggerRuleMutation,
    debugTriggerRuleMutation,
    saveMonitorConfigMutation,
    toggleMonitorEnabledMutation,
    liveDebugMutation,
  };
}
