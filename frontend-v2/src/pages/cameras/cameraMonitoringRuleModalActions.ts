import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

import type { CameraTriggerRule } from '@/shared/api/configCenter';
import {
  DEFAULT_TRIGGER_RULE_VALUES,
  type TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';

type CreateTriggerRuleMutation = {
  mutateAsync: (variables: {
    targetCameraId: string;
    payload: TriggerRuleFormValues;
  }) => Promise<unknown>;
};

type UpdateTriggerRuleMutation = {
  mutateAsync: (variables: {
    targetCameraId: string;
    ruleId: string;
    payload: TriggerRuleFormValues;
  }) => Promise<unknown>;
};

type Params = {
  cameraId: string | null;
  message: MessageInstance;
  triggerRuleForm: FormInstance<TriggerRuleFormValues>;
  editingTriggerRule: CameraTriggerRule | null;
  setTriggerRuleModalOpen: Dispatch<SetStateAction<boolean>>;
  setEditingTriggerRule: Dispatch<SetStateAction<CameraTriggerRule | null>>;
  createTriggerRuleMutation: CreateTriggerRuleMutation;
  updateTriggerRuleMutation: UpdateTriggerRuleMutation;
};

export function createTriggerRuleModalActions({
  cameraId,
  message,
  triggerRuleForm,
  editingTriggerRule,
  setTriggerRuleModalOpen,
  setEditingTriggerRule,
  createTriggerRuleMutation,
  updateTriggerRuleMutation,
}: Params) {
  const openCreateTriggerRuleModal = () => {
    setEditingTriggerRule(null);
    triggerRuleForm.setFieldsValue(DEFAULT_TRIGGER_RULE_VALUES);
    setTriggerRuleModalOpen(true);
  };

  const openEditTriggerRuleModal = (rule: CameraTriggerRule) => {
    setEditingTriggerRule(rule);
    triggerRuleForm.setFieldsValue({
      name: rule.name,
      event_type:
        rule.event_type === 'person' || rule.event_type === 'fire' || rule.event_type === 'leak'
          ? rule.event_type
          : 'custom',
      event_key: rule.event_key || '',
      enabled: rule.enabled,
      min_confidence: rule.min_confidence,
      min_consecutive_frames: rule.min_consecutive_frames,
      cooldown_seconds: rule.cooldown_seconds,
      description: rule.description || '',
    });
    setTriggerRuleModalOpen(true);
  };

  const closeTriggerRuleModal = () => {
    setTriggerRuleModalOpen(false);
    setEditingTriggerRule(null);
  };

  const handleSubmitTriggerRule = async (values: TriggerRuleFormValues) => {
    if (!cameraId) {
      return;
    }
    if (values.event_type === 'custom' && !values.event_key?.trim()) {
      message.error('自定义事件必须填写事件键(event_key)');
      return;
    }

    if (editingTriggerRule) {
      await updateTriggerRuleMutation.mutateAsync({
        targetCameraId: cameraId,
        ruleId: editingTriggerRule.id,
        payload: values,
      });
      return;
    }

    await createTriggerRuleMutation.mutateAsync({
      targetCameraId: cameraId,
      payload: values,
    });
  };

  return {
    openCreateTriggerRuleModal,
    openEditTriggerRuleModal,
    closeTriggerRuleModal,
    handleSubmitTriggerRule,
  };
}
