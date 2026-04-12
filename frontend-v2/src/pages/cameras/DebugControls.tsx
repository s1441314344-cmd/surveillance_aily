import { Alert, Button, Collapse, Input, Space, Switch, Typography } from 'antd';

const { Text } = Typography;

type DebugControlsProps = {
  triggerDebugDryRun: boolean;
  triggerDebugCaptureOnMatch: boolean;
  debugRuleLoading: boolean;
  liveDebugLoading: boolean;
  debugSignalsJson: string;
  debugConsecutiveJson: string;
  onSetTriggerDebugDryRun: (value: boolean) => void;
  onSetTriggerDebugCaptureOnMatch: (value: boolean) => void;
  onSetDebugSignalsJson: (value: string) => void;
  onSetDebugConsecutiveJson: (value: string) => void;
  onRunTriggerRulesDebug: () => void;
  onRunLiveDebug: () => void;
};

export function DebugControls({
  triggerDebugDryRun,
  triggerDebugCaptureOnMatch,
  debugRuleLoading,
  liveDebugLoading,
  debugSignalsJson,
  debugConsecutiveJson,
  onSetTriggerDebugDryRun,
  onSetTriggerDebugCaptureOnMatch,
  onSetDebugSignalsJson,
  onSetDebugConsecutiveJson,
  onRunTriggerRulesDebug,
  onRunLiveDebug,
}: DebugControlsProps) {
  return (
    <Space orientation="vertical" size={12} className="stack-full">
      <Alert
        type="info"
        showIcon
        title="工业场景触发点配置"
        description="支持人员出现、疑似着火、疑似漏水和自定义事件，规则调试和实时调试都集中放在当前页。"
      />

      <Space wrap>
        <Space size={6}>
          <Text type="secondary">仅调试不落库</Text>
          <Switch checked={triggerDebugDryRun} onChange={onSetTriggerDebugDryRun} />
        </Space>
        <Space size={6}>
          <Text type="secondary">命中即拍照</Text>
          <Switch
            checked={triggerDebugCaptureOnMatch}
            disabled={triggerDebugDryRun}
            onChange={onSetTriggerDebugCaptureOnMatch}
          />
        </Space>
        <Button type="primary" loading={debugRuleLoading} onClick={onRunTriggerRulesDebug}>
          调试规则
        </Button>
        <Button loading={liveDebugLoading} onClick={onRunLiveDebug}>
          实时调试
        </Button>
      </Space>

      <Collapse
        items={[
          {
            key: 'advanced-debug',
            label: '高级调试输入',
            children: (
              <Space orientation="vertical" size={12} className="stack-full">
                <Input.TextArea
                  value={debugSignalsJson}
                  onChange={(event) => onSetDebugSignalsJson(event.target.value)}
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  placeholder="信号输入(JSON)"
                />
                <Input.TextArea
                  value={debugConsecutiveJson}
                  onChange={(event) => onSetDebugConsecutiveJson(event.target.value)}
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  placeholder="连续帧输入(JSON)"
                />
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
}
