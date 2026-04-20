import { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type ModelCallLog } from '@/shared/api/modelProviders';
import { StatusBadge } from '@/shared/ui';

const { Paragraph, Text } = Typography;

type ProviderCallLogPanelProps = {
  logs: ModelCallLog[];
  loading: boolean;
  error: string | null;
};

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  provider_debug: '配置调试',
  job_upload: '任务上传',
  job_camera: '摄像头任务',
  schedule_precheck: '计划前置判断',
  signal_monitor: '信号监测',
};

function getTriggerLabel(triggerType: string) {
  return TRIGGER_TYPE_LABELS[triggerType] ?? triggerType;
}

function getUsageTokens(usage: Record<string, unknown> | null): number | null {
  if (!usage) {
    return null;
  }
  const total = usage.total_tokens;
  if (typeof total === 'number' && Number.isFinite(total)) {
    return total;
  }
  const input =
    typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : typeof usage.prompt_tokens === 'number'
      ? usage.prompt_tokens
      : 0;
  const output =
    typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : typeof usage.completion_tokens === 'number'
      ? usage.completion_tokens
      : 0;
  const sum = Number(input) + Number(output);
  return Number.isFinite(sum) && sum > 0 ? sum : null;
}

function buildSummary(logs: ModelCallLog[]) {
  const triggerCountMap = new Map<string, number>();
  let successCount = 0;

  for (const item of logs) {
    if (item.success) {
      successCount += 1;
    }
    triggerCountMap.set(item.trigger_type, (triggerCountMap.get(item.trigger_type) ?? 0) + 1);
  }

  const triggerSummary = Array.from(triggerCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return {
    successCount,
    failedCount: logs.length - successCount,
    triggerSummary,
  };
}

function getSituationText(log: ModelCallLog): string {
  if (log.error_message) {
    return log.error_message;
  }

  const context: string[] = [];
  if (log.trigger_source) {
    context.push(`source=${log.trigger_source}`);
  }
  if (log.job_id) {
    context.push(`job=${log.job_id}`);
  }
  if (log.schedule_id) {
    context.push(`schedule=${log.schedule_id}`);
  }
  if (log.camera_id) {
    context.push(`camera=${log.camera_id}`);
  }
  if (log.strategy_id) {
    context.push(`strategy=${log.strategy_id}`);
  }
  return context.length ? context.join(' | ') : '-';
}

function toSafeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getInputSummary(log: ModelCallLog): string {
  const details = toSafeObject(log.details);
  const input = toSafeObject(details?.input);
  if (!input) {
    return `image_count=${log.input_image_count || 0}`;
  }
  const pieces: string[] = [];
  const promptPreview = typeof input.prompt_preview === 'string' ? input.prompt_preview : '';
  const responseFormat = typeof input.response_format === 'string' ? input.response_format : '';
  const imageCount = typeof input.image_count === 'number' ? input.image_count : log.input_image_count;
  if (responseFormat) {
    pieces.push(`format=${responseFormat}`);
  }
  pieces.push(`images=${imageCount || 0}`);
  if (promptPreview) {
    pieces.push(`prompt=${promptPreview}`);
  }
  const summary = toSafeObject(input.summary);
  if (summary) {
    const summaryText = JSON.stringify(summary);
    pieces.push(`summary=${summaryText}`);
  }
  return pieces.join(' | ') || '-';
}

function getOutputSummary(log: ModelCallLog): string {
  if (log.error_message) {
    return `error=${log.error_message}`;
  }
  const details = toSafeObject(log.details);
  const output = toSafeObject(details?.output);
  if (!output) {
    return 'success';
  }
  const pieces: string[] = [];
  const normalizedPreview = typeof output.normalized_preview === 'string' ? output.normalized_preview : '';
  const rawPreview = typeof output.raw_preview === 'string' ? output.raw_preview : '';
  const outputError = typeof output.error === 'string' ? output.error : '';
  if (outputError) {
    pieces.push(`error=${outputError}`);
  }
  if (normalizedPreview) {
    pieces.push(`json=${normalizedPreview}`);
  }
  if (rawPreview) {
    pieces.push(`raw=${rawPreview}`);
  }
  return pieces.join(' | ') || '-';
}

function toPrettyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderClampText(value: string, rows = 2) {
  const content = value || '-';
  return (
    <Paragraph
      className="call-log-clamp-text"
      ellipsis={{ rows, tooltip: content }}
    >
      {content}
    </Paragraph>
  );
}

export function ProviderCallLogPanel({ logs, loading, error }: ProviderCallLogPanelProps) {
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [activeLog, setActiveLog] = useState<ModelCallLog | null>(null);

  const triggerOptions = useMemo(
    () => [
      { label: '全部触发类型', value: 'all' },
      ...Array.from(new Set(logs.map((item) => item.trigger_type)))
        .sort()
        .map((value) => ({ label: getTriggerLabel(value), value })),
    ],
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const keywordText = keyword.trim().toLowerCase();
    return logs.filter((item) => {
      if (triggerFilter !== 'all' && item.trigger_type !== triggerFilter) {
        return false;
      }
      if (resultFilter === 'success' && !item.success) {
        return false;
      }
      if (resultFilter === 'failed' && item.success) {
        return false;
      }
      if (!keywordText) {
        return true;
      }
      const haystack = [
        item.model_name,
        item.provider,
        item.trigger_type,
        item.trigger_source ?? '',
        item.error_message ?? '',
        getInputSummary(item),
        getOutputSummary(item),
        getSituationText(item),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keywordText);
    });
  }, [keyword, logs, resultFilter, triggerFilter]);

  const columns = useMemo<ColumnsType<ModelCallLog>>(
    () => [
      {
        title: '调用时间',
        dataIndex: 'created_at',
        width: 190,
        render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
      },
      {
        title: '触发类型',
        key: 'trigger',
        width: 160,
        render: (_, record) => (
          <div className="page-stack-tight">
            {renderClampText(getTriggerLabel(record.trigger_type), 1)}
            {record.trigger_source ? (
              <Text type="secondary" ellipsis={{ tooltip: true }}>{record.trigger_source}</Text>
            ) : null}
          </div>
        ),
      },
      {
        title: '结果',
        dataIndex: 'success',
        width: 92,
        render: (value: boolean) => (
          <StatusBadge namespace="generic" value={value ? 'success' : 'failed'} label={value ? '成功' : '失败'} />
        ),
      },
      {
        title: '模型',
        key: 'model',
        width: 190,
        render: (_, record) => (
          <div className="page-stack-tight">
            {renderClampText(record.model_name || '-', 1)}
            <Text type="secondary" ellipsis={{ tooltip: true }}>{record.provider}</Text>
          </div>
        ),
      },
      {
        title: 'Token',
        key: 'usage',
        width: 110,
        render: (_, record) => {
          const totalTokens = getUsageTokens(record.usage);
          return totalTokens !== null ? totalTokens.toLocaleString() : '-';
        },
      },
      {
        title: '输入摘要',
        key: 'input',
        width: 280,
        render: (_, record) => renderClampText(getInputSummary(record), 2),
      },
      {
        title: '输出摘要',
        key: 'output',
        width: 300,
        render: (_, record) => renderClampText(getOutputSummary(record), 2),
      },
      {
        title: '实际情况',
        key: 'situation',
        width: 320,
        render: (_, record) => renderClampText(getSituationText(record), 2),
      },
      {
        title: '详情',
        key: 'action',
        width: 88,
        fixed: 'right',
        render: (_, record) => (
          <Button type="link" onClick={() => setActiveLog(record)}>
            查看
          </Button>
        ),
      },
    ],
    [],
  );

  const summary = useMemo(() => buildSummary(filteredLogs), [filteredLogs]);
  const activeDetails = toSafeObject(activeLog?.details);

  return (
    <div className="page-stack">
      {error ? <Alert type="error" showIcon title={error} /> : null}

      <div className="call-log-toolbar">
        <Select
          className="page-toolbar-field--md"
          value={triggerFilter}
          options={triggerOptions}
          onChange={(value) => setTriggerFilter(value)}
        />
        <Select
          className="page-toolbar-field"
          value={resultFilter}
          onChange={(value) => setResultFilter(value)}
          options={[
            { label: '全部结果', value: 'all' },
            { label: '成功', value: 'success' },
            { label: '失败', value: 'failed' },
          ]}
        />
        <Input.Search
          className="page-toolbar-field--lg"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="筛选模型名/触发类型/输入输出关键字"
        />
      </div>

      <Space size={[8, 8]} wrap>
        <Tag color="blue">总调用: {filteredLogs.length}</Tag>
        <Tag color="green">成功: {summary.successCount}</Tag>
        <Tag color="red">失败: {summary.failedCount}</Tag>
        {summary.triggerSummary.map(([triggerType, count]) => (
          <Tag key={triggerType}>
            {getTriggerLabel(triggerType)} {count}
          </Tag>
        ))}
      </Space>

      <Table<ModelCallLog>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={filteredLogs}
        columns={columns}
        tableLayout="fixed"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 1900, y: 460 }}
        locale={{
          emptyText: <Empty description="没有匹配到调用记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />

      <Drawer
        title="调用详情"
        size={760}
        open={Boolean(activeLog)}
        onClose={() => setActiveLog(null)}
      >
        {activeLog ? (
          <div className="page-stack">
            <div className="call-log-detail-grid">
              <div><Text type="secondary">调用时间</Text><div>{activeLog.created_at ? new Date(activeLog.created_at).toLocaleString() : '-'}</div></div>
              <div><Text type="secondary">触发类型</Text><div>{getTriggerLabel(activeLog.trigger_type)}</div></div>
              <div><Text type="secondary">模型</Text><div>{activeLog.provider} / {activeLog.model_name}</div></div>
              <div><Text type="secondary">Token</Text><div>{getUsageTokens(activeLog.usage)?.toLocaleString() ?? '-'}</div></div>
            </div>

            <div>
              <Text strong>输入</Text>
              <pre className="page-code-block call-log-code-block">{toPrettyJson(activeDetails?.input ?? getInputSummary(activeLog))}</pre>
            </div>

            <div>
              <Text strong>输出</Text>
              <pre className="page-code-block call-log-code-block">
                {toPrettyJson(activeDetails?.output ?? getOutputSummary(activeLog))}
              </pre>
            </div>

            <div>
              <Text strong>上下文</Text>
              <pre className="page-code-block call-log-code-block">
                {toPrettyJson(activeDetails?.context ?? {
                  trigger_source: activeLog.trigger_source,
                  job_id: activeLog.job_id,
                  schedule_id: activeLog.schedule_id,
                  camera_id: activeLog.camera_id,
                  strategy_id: activeLog.strategy_id,
                })}
              </pre>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
