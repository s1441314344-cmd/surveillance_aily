import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Collapse,
  Col,
  Divider,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  TableProps,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import type {
  Strategy,
  TrainingConfig,
  TrainingDataset,
  TrainingHistory,
  TrainingOverview,
  TrainingPipelineRunResponse,
  TrainingRun,
} from '@/shared/api/configCenter';
import {
  approveTrainingRun,
  rejectTrainingRun,
  runTrainingPipeline,
  updateTrainingConfig,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const { Text } = Typography;

type TrainingFeedbackPanelProps = {
  overview: TrainingOverview | null;
  config: TrainingConfig | null;
  datasets: TrainingDataset[];
  runs: TrainingRun[];
  strategies: Strategy[];
  history: TrainingHistory[];
  loading: boolean;
  error: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

function formatRate(value: unknown) {
  if (typeof value !== 'number') {
    return '-';
  }
  return `${(value * 100).toFixed(1)}%`;
}

function parseEvaluationSummary(summary: Record<string, unknown> | null) {
  if (!summary) {
    return '-';
  }
  const structured = formatRate(summary.structured_success_rate);
  const success = formatRate(summary.request_success_rate);
  const latency = typeof summary.average_latency_ms === 'number'
    ? `${summary.average_latency_ms.toFixed(0)}ms`
    : '-';
  return `结构化 ${structured} / 成功 ${success} / 时延 ${latency}`;
}

function parseSkippedItem(item: Record<string, unknown>) {
  return {
    strategyName: typeof item.strategy_name === 'string' ? item.strategy_name : '未知策略',
    reason: typeof item.reason === 'string' ? item.reason : 'unknown',
    sampleCount: typeof item.sample_count === 'number' ? item.sample_count : null,
    minSamples: typeof item.min_samples === 'number' ? item.min_samples : null,
    reviewedCount: typeof item.reviewed_count === 'number' ? item.reviewed_count : null,
    alreadyReflowedCount: typeof item.already_reflowed_count === 'number' ? item.already_reflowed_count : null,
  };
}

function renderSkippedReason(item: ReturnType<typeof parseSkippedItem>) {
  if (item.reason === 'no_reviewed_samples') {
    return '没有可用的已复核样本';
  }
  if (item.reason === 'already_reflowed') {
    return `该策略样本已全部回流（已复核 ${item.reviewedCount ?? 0} / 已回流 ${item.alreadyReflowedCount ?? 0}）`;
  }
  if (item.reason === 'insufficient_samples_after_sampling') {
    return '抽样后可用样本不足';
  }
  if (item.reason === 'insufficient_samples') {
    const current = item.sampleCount ?? 0;
    const threshold = item.minSamples ?? 0;
    const gap = Math.max(threshold - current, 0);
    return `未达到最小样本门槛（当前 ${current} / 门槛 ${threshold}，还差 ${gap}）`;
  }
  return item.reason;
}

export function TrainingFeedbackPanel({
  overview,
  config,
  datasets,
  runs,
  strategies,
  history,
  loading,
  error,
}: TrainingFeedbackPanelProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [lastPipelineResult, setLastPipelineResult] = useState<TrainingPipelineRunResponse | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [draftMinSamples, setDraftMinSamples] = useState<number | null>(null);
  const [isMinSamplesDirty, setIsMinSamplesDirty] = useState(false);

  const effectiveMinSamples = draftMinSamples ?? config?.min_samples ?? 30;

  useEffect(() => {
    if (!isMinSamplesDirty) {
      setDraftMinSamples(config?.min_samples ?? null);
    }
  }, [config?.min_samples, isMinSamplesDirty]);

  const refreshTrainingQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['training-config'] });
    void queryClient.invalidateQueries({ queryKey: ['training-runs'] });
    void queryClient.invalidateQueries({ queryKey: ['training-datasets'] });
    void queryClient.invalidateQueries({ queryKey: ['training-history'] });
  };

  const runPipelineMutation = useMutation({
    mutationFn: () => runTrainingPipeline(selectedStrategyId ? { strategy_id: selectedStrategyId } : {}),
    onSuccess: (result) => {
      setLastPipelineResult(result);
      const strategyHint = selectedStrategyId ? `（策略：${selectedStrategyId.slice(0, 8)}）` : '（全部策略）';
      message.success(`回流流水线已触发${strategyHint}，新增运行 ${result.run_ids.length} 条`);
      refreshTrainingQueries();
    },
    onError: (mutationError) => {
      message.error(getApiErrorMessage(mutationError, '训练回流触发失败'));
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (minSamples: number) => updateTrainingConfig({ min_samples: minSamples }),
    onSuccess: (result) => {
      setDraftMinSamples(result.min_samples);
      setIsMinSamplesDirty(false);
      message.success(`最小样本门槛已更新为 ${result.min_samples}`);
      refreshTrainingQueries();
    },
    onError: (mutationError) => {
      message.error(getApiErrorMessage(mutationError, '门槛保存失败'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: (runId: string) => approveTrainingRun(runId, {}),
    onSuccess: () => {
      message.success('审批发布成功');
      refreshTrainingQueries();
    },
    onError: (mutationError) => {
      message.error(getApiErrorMessage(mutationError, '审批发布失败'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (runId: string) => rejectTrainingRun(runId, {}),
    onSuccess: () => {
      message.success('已驳回该候选版本');
      refreshTrainingQueries();
    },
    onError: (mutationError) => {
      message.error(getApiErrorMessage(mutationError, '驳回失败'));
    },
  });

  const columns = useMemo(
    () => [
      {
        title: 'Run ID',
        dataIndex: 'id',
        key: 'id',
        width: 180,
        ellipsis: true,
      },
      {
        title: '策略',
        dataIndex: 'strategy_name',
        key: 'strategy_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: '路由',
        key: 'route',
        width: 160,
        render: (_: unknown, record: TrainingRun) => (
          <Space size={4} wrap>
            <Tag>{record.route_requested}</Tag>
            <Text type="secondary">→</Text>
            <Tag color="blue">{record.route_actual}</Tag>
          </Space>
        ),
      },
      {
        title: '状态',
        key: 'status',
        width: 140,
        render: (_: unknown, record: TrainingRun) => (
          <Space size={4} wrap>
            <Tag color={record.status === 'completed' ? 'green' : record.status === 'failed' ? 'red' : 'gold'}>
              {record.status}
            </Tag>
            {record.release_status ? <Tag color="purple">{record.release_status}</Tag> : null}
          </Space>
        ),
      },
      {
        title: '样本数',
        dataIndex: 'sample_count',
        key: 'sample_count',
        width: 90,
      },
      {
        title: '评估摘要',
        key: 'evaluation_summary',
        ellipsis: true,
        render: (_: unknown, record: TrainingRun) => parseEvaluationSummary(record.evaluation_summary),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (value: string | null) => formatDate(value),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_: unknown, record: TrainingRun) => {
          const disabled = record.status !== 'completed' || record.release_status !== 'pending';
          return (
            <Space size={4} wrap>
              <Popconfirm
                title="确认审批发布该候选版本？"
                onConfirm={() => approveMutation.mutate(record.id)}
                disabled={disabled}
              >
                <Button size="small" type="primary" disabled={disabled} loading={approveMutation.isPending}>
                  审批发布
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认驳回该候选版本？"
                onConfirm={() => rejectMutation.mutate(record.id)}
                disabled={disabled}
              >
                <Button size="small" danger disabled={disabled} loading={rejectMutation.isPending}>
                  驳回
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [approveMutation, rejectMutation],
  );

  const datasetColumns = useMemo<TableProps<TrainingDataset>['columns']>(
    () => [
      {
        title: 'Dataset ID',
        dataIndex: 'id',
        key: 'id',
        width: 180,
        ellipsis: true,
      },
      {
        title: '策略',
        dataIndex: 'strategy_name',
        key: 'strategy_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: '提供方/模型',
        key: 'provider_model',
        width: 220,
        ellipsis: true,
        render: (_: unknown, record: TrainingDataset) => `${record.model_provider} / ${record.model_name}`,
      },
      {
        title: '样本',
        key: 'sample',
        width: 140,
        render: (_: unknown, record: TrainingDataset) =>
          `${record.sample_count}（错 ${record.incorrect_count} / 对 ${record.correct_count}）`,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (value: string | null) => formatDate(value),
      },
    ],
    [],
  );

  const runColumns = useMemo<TableProps<TrainingRun>['columns']>(() => columns, [columns]);
  const historyColumns = useMemo<TableProps<TrainingHistory>['columns']>(
    () => [
      {
        title: '回流时间',
        dataIndex: 'reflowed_at',
        key: 'reflowed_at',
        width: 180,
        render: (value: string | null) => formatDate(value),
      },
      {
        title: '策略',
        dataIndex: 'strategy_name',
        key: 'strategy_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: 'Record ID',
        dataIndex: 'record_id',
        key: 'record_id',
        width: 160,
        ellipsis: true,
      },
      {
        title: '复核结论',
        dataIndex: 'judgement',
        key: 'judgement',
        width: 100,
      },
      {
        title: '回流 Run',
        dataIndex: 'reflow_run_id',
        key: 'reflow_run_id',
        width: 160,
        ellipsis: true,
        render: (value: string | null) => value || '-',
      },
      {
        title: '回流 Dataset',
        dataIndex: 'reflow_dataset_id',
        key: 'reflow_dataset_id',
        width: 160,
        ellipsis: true,
        render: (value: string | null) => value || '-',
      },
    ],
    [],
  );

  const strategyOptions = useMemo(
    () =>
      strategies
        .filter((item) => item.status === 'active')
        .map((item) => ({
          label: item.name,
          value: item.id,
        })),
    [strategies],
  );
  const selectedStrategyLabel = useMemo(
    () => strategyOptions.find((item) => item.value === selectedStrategyId)?.label ?? null,
    [selectedStrategyId, strategyOptions],
  );
  const visibleDatasets = useMemo(
    () =>
      selectedStrategyId
        ? datasets.filter((item) => item.strategy_id === selectedStrategyId)
        : datasets,
    [datasets, selectedStrategyId],
  );
  const visibleRuns = useMemo(
    () =>
      selectedStrategyId
        ? runs.filter((item) => item.strategy_id === selectedStrategyId)
        : runs,
    [runs, selectedStrategyId],
  );
  const visibleHistory = useMemo(
    () =>
      selectedStrategyId
        ? history.filter((item) => item.strategy_id === selectedStrategyId)
        : history,
    [history, selectedStrategyId],
  );
  const latestDataset = visibleDatasets[0] ?? null;
  const latestRun = visibleRuns[0] ?? null;
  const skipItems = lastPipelineResult?.skipped ?? [];
  const hasSkipped = skipItems.length > 0;

  return (
    <div className="page-stack">
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="已复核样本" value={overview?.reviewed_samples ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="候选样本池" value={overview?.candidate_samples ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="待审批发布" value={overview?.pending_release_requests ?? 0} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Statistic title="最近运行" value={overview?.last_run_status || '-'} />
        </Col>
      </Row>

      <Space align="center" wrap>
        <Select
          style={{ width: 320 }}
          allowClear
          placeholder="选择策略（不选=全部策略）"
          options={strategyOptions}
          value={selectedStrategyId ?? undefined}
          onChange={(value) => setSelectedStrategyId(value ?? null)}
          showSearch
          optionFilterProp="label"
        />
        <InputNumber
          min={1}
          max={10000}
          value={effectiveMinSamples}
          onChange={(value) => {
            setDraftMinSamples(typeof value === 'number' ? value : null);
            setIsMinSamplesDirty(true);
          }}
        />
        <Button
          onClick={() => updateConfigMutation.mutate(Math.max(1, Number(effectiveMinSamples || 1)))}
          loading={updateConfigMutation.isPending}
          disabled={!isMinSamplesDirty}
        >
          保存门槛
        </Button>
        <Button type="primary" onClick={() => runPipelineMutation.mutate()} loading={runPipelineMutation.isPending}>
          触发未回流任务
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        message={`当前触发范围：${selectedStrategyLabel ? `单策略（${selectedStrategyLabel}）` : '全部策略'} · 当前门槛：${config?.min_samples ?? '-'}`}
        description={
          latestDataset
            ? `最新数据集：${latestDataset.id} · 样本 ${latestDataset.sample_count}（incorrect ${latestDataset.incorrect_count} / correct ${latestDataset.correct_count}）`
            : '暂无可用数据集，先触发一次回流以生成运行记录。'
        }
      />

      <Divider className="page-divider-compact" />

      <Alert
        type="info"
        showIcon
        message={`最近运行：${latestRun ? `${latestRun.strategy_name} (${latestRun.status})` : '暂无'} · ${formatDate(latestRun?.created_at ?? null)}`}
      />

      {lastPipelineResult ? (
        (() => {
          const result = lastPipelineResult;
          return (
            <Alert
              type={result.run_ids.length > 0 ? 'success' : 'warning'}
              showIcon
              message={`本次触发结果：新建运行 ${result.run_ids.length} 条，跳过 ${result.skipped.length} 条`}
              description={
                <Space direction="vertical" size={4}>
                  <Text>
                    run_ids：{result.run_ids.length ? result.run_ids.join(', ') : '无'}
                  </Text>
                  {hasSkipped ? (
                    <Collapse
                      size="small"
                      items={[
                        {
                          key: 'skipped',
                          label: `查看跳过详情（${skipItems.length}）`,
                          children: (
                            <Space direction="vertical" size={6}>
                              {skipItems.map((raw, index) => {
                                const item = parseSkippedItem(raw);
                                return (
                                  <Text key={`${item.strategyName}-${index}`}>
                                    {item.strategyName}：{renderSkippedReason(item)}
                                  </Text>
                                );
                              })}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  ) : null}
                </Space>
              }
            />
          );
        })()
      ) : null}

      {error ? <Text type="danger">{error}</Text> : null}

      <Table<TrainingRun>
        rowKey="id"
        loading={loading}
        columns={runColumns}
        dataSource={visibleRuns}
        size="small"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 1200 }}
      />

      <Collapse
        size="small"
        items={[
          {
            key: 'history',
            label: `回流历史（${visibleHistory.length}）`,
            children: (
              <Table<TrainingHistory>
                rowKey="candidate_id"
                loading={loading}
                columns={historyColumns}
                dataSource={visibleHistory}
                size="small"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                scroll={{ x: 1200 }}
              />
            ),
          },
          {
            key: 'datasets',
            label: `高级信息：数据集列表（${visibleDatasets.length}）`,
            children: (
              <Table<TrainingDataset>
                rowKey="id"
                loading={loading}
                columns={datasetColumns}
                dataSource={visibleDatasets}
                size="small"
                pagination={{ pageSize: 5, showSizeChanger: false }}
                scroll={{ x: 1100 }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
