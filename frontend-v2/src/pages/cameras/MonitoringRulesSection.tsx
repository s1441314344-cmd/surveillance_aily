import { Button, Empty, Space } from 'antd';
import type { CameraTriggerRule, CameraTriggerRuleDebugResult, DebugLiveResult } from '@/shared/api/cameras';
import { SectionCard } from '@/shared/ui';
import { DebugControls } from './DebugControls';
import { DebugResultPanel } from './DebugResultPanel';
import { RuleListPanel } from './RuleListPanel';

type MonitoringRulesSectionProps = {
  effectiveSelectedCameraId: string | null;
  selectedCameraTriggerRules: CameraTriggerRule[];
  triggerRulesLoading: boolean;
  debugRuleLoading: boolean;
  liveDebugLoading: boolean;
  deleteRuleLoading: boolean;
  triggerDebugDryRun: boolean;
  triggerDebugCaptureOnMatch: boolean;
  debugSignalsJson: string;
  debugConsecutiveJson: string;
  triggerDebugResult: CameraTriggerRuleDebugResult | null;
  liveDebugResult: DebugLiveResult | null;
  onSetTriggerDebugDryRun: (value: boolean) => void;
  onSetTriggerDebugCaptureOnMatch: (value: boolean) => void;
  onSetDebugSignalsJson: (value: string) => void;
  onSetDebugConsecutiveJson: (value: string) => void;
  onRunTriggerRulesDebug: () => void;
  onRunLiveDebug: () => void;
  onCreateRule: () => void;
  onEditRule: (rule: CameraTriggerRule) => void;
  onDeleteRule: (ruleId: string) => void;
};

export function MonitoringRulesSection({
  effectiveSelectedCameraId,
  selectedCameraTriggerRules,
  triggerRulesLoading,
  debugRuleLoading,
  liveDebugLoading,
  deleteRuleLoading,
  triggerDebugDryRun,
  triggerDebugCaptureOnMatch,
  debugSignalsJson,
  debugConsecutiveJson,
  triggerDebugResult,
  liveDebugResult,
  onSetTriggerDebugDryRun,
  onSetTriggerDebugCaptureOnMatch,
  onSetDebugSignalsJson,
  onSetDebugConsecutiveJson,
  onRunTriggerRulesDebug,
  onRunLiveDebug,
  onCreateRule,
  onEditRule,
  onDeleteRule,
}: MonitoringRulesSectionProps) {
  return (
    <SectionCard
      title="抽帧触发规则"
      actions={
        effectiveSelectedCameraId ? (
          <Button size="small" type="primary" onClick={onCreateRule}>
            新增规则
          </Button>
        ) : null
      }
    >
      {effectiveSelectedCameraId ? (
        <Space orientation="vertical" size={12} className="stack-full">
          <DebugControls
            triggerDebugDryRun={triggerDebugDryRun}
            triggerDebugCaptureOnMatch={triggerDebugCaptureOnMatch}
            debugRuleLoading={debugRuleLoading}
            liveDebugLoading={liveDebugLoading}
            debugSignalsJson={debugSignalsJson}
            debugConsecutiveJson={debugConsecutiveJson}
            onSetTriggerDebugDryRun={onSetTriggerDebugDryRun}
            onSetTriggerDebugCaptureOnMatch={onSetTriggerDebugCaptureOnMatch}
            onSetDebugSignalsJson={onSetDebugSignalsJson}
            onSetDebugConsecutiveJson={onSetDebugConsecutiveJson}
            onRunTriggerRulesDebug={onRunTriggerRulesDebug}
            onRunLiveDebug={onRunLiveDebug}
          />

          <DebugResultPanel liveDebugResult={liveDebugResult} triggerDebugResult={triggerDebugResult} />

          <RuleListPanel
            selectedCameraTriggerRules={selectedCameraTriggerRules}
            triggerRulesLoading={triggerRulesLoading}
            deleteRuleLoading={deleteRuleLoading}
            onEditRule={onEditRule}
            onDeleteRule={onDeleteRule}
          />
        </Space>
      ) : (
        <Empty description="请选择一个摄像头后配置触发规则" />
      )}
    </SectionCard>
  );
}
