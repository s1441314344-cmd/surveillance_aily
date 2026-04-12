import { Button, Empty, Popconfirm, Space, Tag, Typography } from 'antd';
import { TRIGGER_EVENT_TYPE_LABELS } from './cameraCenterConfig';
import type { CameraTriggerRule } from '@/shared/api/configCenter';
import { DataStateBlock, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const { Text } = Typography;

type RuleListPanelProps = {
  selectedCameraTriggerRules: CameraTriggerRule[];
  triggerRulesLoading: boolean;
  deleteRuleLoading: boolean;
  onEditRule: (rule: CameraTriggerRule) => void;
  onDeleteRule: (ruleId: string) => void;
};

export function RuleListPanel({
  selectedCameraTriggerRules,
  triggerRulesLoading,
  deleteRuleLoading,
  onEditRule,
  onDeleteRule,
}: RuleListPanelProps) {
  if (triggerRulesLoading) {
    return (
      <DataStateBlock loading minHeight={120}>
        <></>
      </DataStateBlock>
    );
  }

  if (!selectedCameraTriggerRules.length) {
    return <Empty description="暂无触发规则，请先新增规则" />;
  }

  return (
    <Space orientation="vertical" size={8} className="stack-full">
      {selectedCameraTriggerRules.map((rule) => (
        <div key={rule.id} className="console-block camera-rule-item">
          <Space orientation="vertical" size={6} className="stack-full">
            <Space wrap>
              <Text strong>{rule.name}</Text>
              <StatusBadge
                namespace="generic"
                value="info"
                label={TRIGGER_EVENT_TYPE_LABELS[rule.event_type] ?? UNKNOWN_LABELS.event}
              />
              <Tag>{rule.event_key || TRIGGER_EVENT_TYPE_LABELS[rule.event_type] || UNKNOWN_LABELS.event}</Tag>
              <StatusBadge namespace="generic" value={rule.enabled ? 'enabled' : 'disabled'} label={rule.enabled ? '启用' : '禁用'} />
            </Space>
            <Text type="secondary">阈值 {rule.min_confidence.toFixed(2)}，连续帧 {rule.min_consecutive_frames}，冷却 {rule.cooldown_seconds} 秒</Text>
            <Text type="secondary">最近触发：{rule.last_triggered_at ? new Date(rule.last_triggered_at).toLocaleString() : '暂无'}</Text>
            {rule.description ? <Text>{rule.description}</Text> : null}
            <Space wrap>
              <Button size="small" onClick={() => onEditRule(rule)}>编辑</Button>
              <Popconfirm title="删除该触发规则？" okText="删除" cancelText="取消" onConfirm={() => onDeleteRule(rule.id)}>
                <Button danger size="small" loading={deleteRuleLoading}>删除</Button>
              </Popconfirm>
            </Space>
          </Space>
        </div>
      ))}
    </Space>
  );
}
