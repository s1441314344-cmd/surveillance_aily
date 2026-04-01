import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Col,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import type {
  TrainingDataset,
  TrainingOverview,
  TrainingRun,
} from '@/shared/api/configCenter';
import {
  approveTrainingRun,
  rejectTrainingRun,
  runTrainingPipeline,
} from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';

const { Text } = Typography;

type TrainingFeedbackPanelProps = {
  provider: string | null;
  overview: TrainingOverview | null;
  datasets: TrainingDataset[];
  runs: TrainingRun[];
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

export function TrainingFeedbackPanel({
  provider,
  overview,
  datasets,
  runs,
  loading,
  error,
}: TrainingFeedbackPanelProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const latestDataset = datasets[0] ?? null;

  const refreshTrainingQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['training-runs'] });
    void queryClient.invalidateQueries({ queryKey: ['training-datasets'] });
  };

  const runPipelineMutation = useMutation({
    mutationFn: () => runTrainingPipeline(),
    onSuccess: (result) => {
      message.success(`回流流水线已触发，新增运行 ${result.run_ids.length} 条`);
      refreshTrainingQueries();
    },
    onError: (mutationError) => {
      message.error(getApiErrorMessage(mutationError, '训练回流触发失败'));
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
        <Button type="primary" onClick={() => runPipelineMutation.mutate()} loading={runPipelineMutation.isPending}>
          手工触发回流
        </Button>
        <Text type="secondary">
          当前过滤提供方：{provider || '全部'}
        </Text>
        <Text type="secondary">
          最近运行时间：{formatDate(overview?.last_run_at)}
        </Text>
      </Space>

      {latestDataset ? (
        <Text type="secondary">
          最新数据集：{latestDataset.id} · 样本 {latestDataset.sample_count}（incorrect {latestDataset.incorrect_count} / correct {latestDataset.correct_count}）
        </Text>
      ) : null}

      {error ? <Text type="danger">{error}</Text> : null}

      <Table<TrainingRun>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={runs}
        size="small"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
}
