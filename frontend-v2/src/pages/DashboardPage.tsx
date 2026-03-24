import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Table,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { listModelProviders, listStrategies } from '@/shared/api/configCenter';
import { getApiErrorMessage } from '@/shared/api/errors';
import {
  getDashboardAnomalies,
  getDashboardStrategies,
  getDashboardSummary,
  getDashboardTrends,
} from '@/shared/api/dashboard';

const { Paragraph, Text, Title } = Typography;
const resultStatusColorMap: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  schema_invalid: 'orange',
};
const feedbackStatusColorMap: Record<string, string> = {
  unreviewed: 'default',
  correct: 'green',
  incorrect: 'red',
};
const anomalyTypeLabelMap: Record<string, string> = {
  schema_invalid: '结构化异常',
  task_failed: '执行失败',
  feedback_incorrect: '人工判错',
  unknown: '未知异常',
};
const anomalyTypeColorMap: Record<string, string> = {
  schema_invalid: 'orange',
  task_failed: 'red',
  feedback_incorrect: 'volcano',
  unknown: 'default',
};

const parseDateFilter = (value: string) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [modelProviderFilter, setModelProviderFilter] = useState<string>('all');
  const [createdFromFilter, setCreatedFromFilter] = useState<string>('');
  const [createdToFilter, setCreatedToFilter] = useState<string>('');

  const queryFilters = {
    strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
    modelProvider: modelProviderFilter === 'all' ? undefined : modelProviderFilter,
    createdFrom: parseDateFilter(createdFromFilter),
    createdTo: parseDateFilter(createdToFilter),
  };

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'all-for-dashboard'],
    queryFn: () => listStrategies(),
  });

  const modelProviderQuery = useQuery({
    queryKey: ['model-providers', 'all-for-dashboard'],
    queryFn: () => listModelProviders(),
  });

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', queryFilters],
    queryFn: () => getDashboardSummary(queryFilters),
    refetchInterval: 15000,
  });

  const trendsQuery = useQuery({
    queryKey: ['dashboard', 'trends', queryFilters],
    queryFn: () => getDashboardTrends(queryFilters),
    refetchInterval: 15000,
  });

  const strategiesQuery = useQuery({
    queryKey: ['dashboard', 'strategies', queryFilters],
    queryFn: () => getDashboardStrategies(queryFilters),
    refetchInterval: 15000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['dashboard', 'anomalies', queryFilters],
    queryFn: () => getDashboardAnomalies(queryFilters),
    refetchInterval: 15000,
  });

  const summary = summaryQuery.data;
  const dashboardError =
    summaryQuery.error || trendsQuery.error || strategiesQuery.error || anomaliesQuery.error;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          总览看板
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          基于任务、记录和人工复核数据生成当前运行概览。准确率指标仅统计已复核记录。
        </Paragraph>
      </div>

      <Card size="small" title="筛选条件">
        <Space wrap>
          <Select
            size="small"
            value={strategyFilter}
            onChange={setStrategyFilter}
            options={[
              { label: '全部策略', value: 'all' },
              ...(strategyQuery.data ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              })),
            ]}
            style={{ width: 180 }}
          />
          <Select
            size="small"
            value={modelProviderFilter}
            onChange={setModelProviderFilter}
            options={[
              { label: '全部模型提供方', value: 'all' },
              ...(modelProviderQuery.data ?? []).map((item) => ({
                label: item.display_name || item.provider,
                value: item.provider,
              })),
            ]}
            style={{ width: 180 }}
          />
          <Input
            size="small"
            type="datetime-local"
            value={createdFromFilter}
            onChange={(event) => setCreatedFromFilter(event.target.value)}
            style={{ width: 200 }}
          />
          <Input
            size="small"
            type="datetime-local"
            value={createdToFilter}
            onChange={(event) => setCreatedToFilter(event.target.value)}
            style={{ width: 200 }}
          />
        </Space>
      </Card>

      {dashboardError ? (
        <Alert
          type="error"
          showIcon
          title="看板数据加载失败"
          description={getApiErrorMessage(dashboardError, '请稍后重试')}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="任务总数" value={summary?.total_jobs ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="记录总数" value={summary?.total_records ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="结构化成功率" value={summary?.structured_success_rate ?? 0} suffix="%" />
            </Card>
          </Col>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="结构化异常数" value={summary?.schema_invalid_count ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="已复核率" value={summary?.reviewed_rate ?? 0} suffix="%" />
            </Card>
          </Col>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="人工确认准确率" value={summary?.confirmed_accuracy_rate ?? 0} suffix="%" />
            </Card>
          </Col>
          <Col xs={24} md={8} xl={4}>
            <Card loading={summaryQuery.isLoading}>
              <Statistic title="待复核记录" value={summary?.pending_review_count ?? 0} />
            </Card>
          </Col>
        </Row>

        <Col xs={24} xl={9}>
          <Card title="运行质量" loading={summaryQuery.isLoading} style={{ height: '100%' }}>
            <Space orientation="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Text strong>任务成功率</Text>
                <Progress percent={summary?.success_rate ?? 0} strokeColor="#1677ff" />
              </div>
              <div>
                <Text strong>异常案例占比</Text>
                <Progress percent={summary?.anomaly_rate ?? 0} strokeColor="#fa541c" />
              </div>
              <div>
                <Text strong>结构化异常率</Text>
                <Progress percent={summary?.schema_invalid_rate ?? 0} strokeColor="#fa8c16" />
              </div>
              <div>
                <Text strong>人工确认准确率</Text>
                <Progress percent={summary?.confirmed_accuracy_rate ?? 0} strokeColor="#52c41a" />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card title="任务趋势" loading={trendsQuery.isLoading} style={{ height: '100%' }}>
            <Table
              rowKey="date"
              size="small"
              pagination={false}
              locale={{ emptyText: <Empty description="暂无趋势数据" /> }}
              dataSource={trendsQuery.data ?? []}
              columns={[
                {
                  title: '日期',
                  dataIndex: 'date',
                },
                {
                  title: '任务数',
                  dataIndex: 'total_jobs',
                  width: 120,
                },
                {
                  title: '成功率',
                  dataIndex: 'success_rate',
                  width: 140,
                  render: (value: number) => `${value}%`,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="策略使用排行" loading={strategiesQuery.isLoading} style={{ height: '100%' }}>
            <Table
              rowKey="strategy_id"
              size="small"
              pagination={false}
              locale={{ emptyText: <Empty description="暂无策略使用数据" /> }}
              dataSource={strategiesQuery.data ?? []}
              columns={[
                {
                  title: '策略',
                  dataIndex: 'strategy_name',
                },
                {
                  title: '使用次数',
                  dataIndex: 'usage_count',
                  width: 120,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card title="异常案例" loading={anomaliesQuery.isLoading} style={{ height: '100%' }}>
            <Table
              rowKey="record_id"
              size="small"
              pagination={false}
              onRow={(record) => ({
                onClick: () => navigate(`/records?recordId=${record.record_id}`),
              })}
              locale={{ emptyText: <Empty description="暂无异常案例" /> }}
              dataSource={anomaliesQuery.data ?? []}
              columns={[
                {
                  title: '时间',
                  dataIndex: 'created_at',
                  width: 180,
                  render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
                },
                {
                  title: '策略',
                  dataIndex: 'strategy_name',
                  width: 140,
                },
                {
                  title: '记录 ID',
                  dataIndex: 'record_id',
                  width: 120,
                  render: (value: string) => <Text code>{value.slice(0, 8)}</Text>,
                },
                {
                  title: '摘要',
                  dataIndex: 'summary',
                  render: (value: string) => (
                    <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</Text>
                  ),
                },
                {
                  title: '异常类型',
                  dataIndex: 'anomaly_type',
                  width: 120,
                  render: (value: string) => (
                    <Tag color={anomalyTypeColorMap[value] ?? 'default'}>
                      {anomalyTypeLabelMap[value] ?? value}
                    </Tag>
                  ),
                },
                {
                  title: '结果状态',
                  dataIndex: 'result_status',
                  width: 120,
                  render: (value: string) => (
                    <Tag color={resultStatusColorMap[value] ?? 'default'}>{value}</Tag>
                  ),
                },
                {
                  title: '反馈状态',
                  dataIndex: 'feedback_status',
                  width: 120,
                  render: (value: string) => (
                    <Tag color={feedbackStatusColorMap[value] ?? 'default'}>{value}</Tag>
                  ),
                },
                {
                  title: '操作',
                  width: 180,
                  render: (_, record) => (
                    <Space size={4}>
                      <Button
                        type="link"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/records?recordId=${record.record_id}`);
                        }}
                      >
                        查看记录
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/feedback?recordId=${record.record_id}`);
                        }}
                      >
                        去复核
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
