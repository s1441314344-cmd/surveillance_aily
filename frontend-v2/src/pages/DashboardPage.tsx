import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Typography } from 'antd';
import { getApiErrorMessage } from '@/shared/api/errors';
import {
  getDashboardAnomalies,
  getDashboardStrategies,
  getDashboardSummary,
  getDashboardTrends,
} from '@/shared/api/dashboard';

const { Paragraph, Text, Title } = Typography;

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 15000,
  });

  const trendsQuery = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: getDashboardTrends,
    refetchInterval: 15000,
  });

  const strategiesQuery = useQuery({
    queryKey: ['dashboard', 'strategies'],
    queryFn: getDashboardStrategies,
    refetchInterval: 15000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['dashboard', 'anomalies'],
    queryFn: getDashboardAnomalies,
    refetchInterval: 15000,
  });

  const summary = summaryQuery.data;
  const dashboardError =
    summaryQuery.error || trendsQuery.error || strategiesQuery.error || anomaliesQuery.error;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          总览看板
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          基于任务、记录和人工复核数据生成当前运行概览。准确率指标仅统计已复核记录。
        </Paragraph>
      </div>

      {dashboardError ? (
        <Alert
          type="error"
          showIcon
          message="看板数据加载失败"
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
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Text strong>任务成功率</Text>
                <Progress percent={summary?.success_rate ?? 0} strokeColor="#1677ff" />
              </div>
              <div>
                <Text strong>异常案例占比</Text>
                <Progress percent={summary?.anomaly_rate ?? 0} strokeColor="#fa541c" />
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
                  title: '摘要',
                  dataIndex: 'summary',
                  render: (value: string) => (
                    <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</Text>
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
