import type { MessageInstance } from 'antd/es/message/interface';

import { parseDebugJsonToRecord } from './cameraDebugParsers';

type DebugTriggerRuleMutation = {
  mutateAsync: (variables: {
    targetCameraId: string;
    payload: {
      signals: Record<string, number>;
      consecutive_hits: Record<string, number>;
      dry_run: boolean;
      capture_on_match: boolean;
      source_kind: 'trigger_rule';
    };
    }) => Promise<unknown>;
};

type LiveDebugMutation = {
  mutateAsync: (variables: {
    targetCameraId: string;
    payload: {
      detected_signals: Record<string, number>;
      source_kind: 'manual_debug';
      include_results: boolean;
    };
    }) => Promise<unknown>;
};

type Params = {
  cameraId: string | null;
  message: MessageInstance;
  debugSignalsJson: string;
  debugConsecutiveJson: string;
  triggerDebugDryRun: boolean;
  triggerDebugCaptureOnMatch: boolean;
  debugTriggerRuleMutation: DebugTriggerRuleMutation;
  liveDebugMutation: LiveDebugMutation;
};

export function createTriggerRuleDebugActions({
  cameraId,
  message,
  debugSignalsJson,
  debugConsecutiveJson,
  triggerDebugDryRun,
  triggerDebugCaptureOnMatch,
  debugTriggerRuleMutation,
  liveDebugMutation,
}: Params) {
  const runTriggerRulesDebug = async () => {
    if (!cameraId) {
      return;
    }

    const parsedSignals = parseDebugJsonToRecord(debugSignalsJson, '信号输入', message);
    if (!parsedSignals) {
      return;
    }
    const parsedConsecutiveHits = parseDebugJsonToRecord(debugConsecutiveJson, '连续帧输入', message);
    if (!parsedConsecutiveHits) {
      return;
    }

    await debugTriggerRuleMutation.mutateAsync({
      targetCameraId: cameraId,
      payload: {
        signals: parsedSignals,
        consecutive_hits: parsedConsecutiveHits,
        dry_run: triggerDebugDryRun,
        capture_on_match: triggerDebugDryRun ? false : triggerDebugCaptureOnMatch,
        source_kind: 'trigger_rule',
      },
    });
  };

  const runLiveDebug = async () => {
    if (!cameraId) {
      return;
    }
    const parsedSignals = parseDebugJsonToRecord(debugSignalsJson, '信号输入', message);
    if (!parsedSignals) {
      return;
    }
    await liveDebugMutation.mutateAsync({
      targetCameraId: cameraId,
      payload: {
        detected_signals: parsedSignals,
        source_kind: 'manual_debug',
        include_results: true,
      },
    });
  };

  return {
    runTriggerRulesDebug,
    runLiveDebug,
  };
}
