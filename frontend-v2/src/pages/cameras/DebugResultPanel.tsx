import { Input, Space, Tag, Typography } from 'antd';
import { TRIGGER_EVENT_TYPE_LABELS } from './cameraCenterConfig';
import type { CameraTriggerRuleDebugResult, DebugLiveResult } from '@/shared/api/configCenter';
import { StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const { Text } = Typography;

type DebugResultPanelProps = {
  liveDebugResult: DebugLiveResult | null;
  triggerDebugResult: CameraTriggerRuleDebugResult | null;
};

export function DebugResultPanel({ liveDebugResult, triggerDebugResult }: DebugResultPanelProps) {
  if (!liveDebugResult && !triggerDebugResult) {
    return null;
  }

  return (
    <Space orientation="vertical" size={12} className="stack-full">
      {liveDebugResult ? (
        <div className="console-block">
          <div className="console-block__title">实时调试结果（命中 {liveDebugResult.matched_count} 条）</div>
          <Space orientation="vertical" size={6} className="stack-full">
            <Text code>{JSON.stringify(liveDebugResult.detected_signals)}</Text>
            <Input.TextArea
              value={JSON.stringify(liveDebugResult.results, null, 2)}
              readOnly
              autoSize={{ minRows: 4, maxRows: 12 }}
            />
          </Space>
        </div>
      ) : null}

      {triggerDebugResult ? (
        <div className="console-block">
          <div className="console-block__title">规则调试结果（命中 {triggerDebugResult.matched_count} 条）</div>
          <Space orientation="vertical" size={8} className="stack-full">
            {triggerDebugResult.results.map((item) => (
              <div key={item.rule_id} className="console-block camera-rule-item">
                <Space orientation="vertical" size={4} className="stack-full">
                  <Space wrap>
                    <Text strong>{item.rule_name}</Text>
                    <StatusBadge
                      namespace="generic"
                      value="info"
                      label={TRIGGER_EVENT_TYPE_LABELS[item.event_type] ?? UNKNOWN_LABELS.event}
                    />
                    <Tag>{item.event_key || '未设置事件键'}</Tag>
                    <StatusBadge namespace="generic" value={item.matched ? 'success' : 'inactive'} label={item.matched ? '命中' : '未命中'} />
                    <StatusBadge
                      namespace="generic"
                      value={item.cooldown_ok ? 'success' : 'warning'}
                      label={`冷却${item.cooldown_ok ? '通过' : `剩余 ${item.cooldown_remaining_seconds}s`}`}
                    />
                  </Space>
                  <Text type="secondary">
                    信号值 {item.confidence.toFixed(3)} / 阈值 {item.threshold.toFixed(3)}，连续帧 {item.consecutive_hits} / 要求 {item.required_consecutive_hits}
                  </Text>
                  <Text>{item.reason}</Text>
                  {item.media ? <Text type="secondary">已抓拍：{item.media.original_name}</Text> : null}
                  {item.error_message ? <Text type="danger">{item.error_message}</Text> : null}
                </Space>
              </div>
            ))}
          </Space>
        </div>
      ) : null}
    </Space>
  );
}
