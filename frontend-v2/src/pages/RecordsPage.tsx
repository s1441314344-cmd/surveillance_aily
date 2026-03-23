import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { getApiErrorMessage } from '@/shared/api/errors';
import { listStrategies } from '@/shared/api/configCenter';
import {
  exportTaskRecords,
  fetchTaskRecordImage,
  getTaskRecord,
  listTaskRecords,
  TaskRecord,
} from '@/shared/api/tasks';

const { Paragraph, Text, Title } = Typography;

const statusColorMap: Record<string, string> = {
  completed: 'green',
  failed: 'red',
  schema_invalid: 'orange',
};

export function RecordsPage() {
  const { message } = App.useApp();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'all-for-records'],
    queryFn: () => listStrategies(),
  });

  const recordsQuery = useQuery({
    queryKey: ['task-records', statusFilter, strategyFilter],
    queryFn: () =>
      listTaskRecords({
        status: statusFilter === 'all' ? undefined : statusFilter,
        strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
      }),
  });

  const recordDetailQuery = useQuery({
    queryKey: ['task-record-detail', selectedRecordId],
    queryFn: () => getTaskRecord(selectedRecordId as string),
    enabled: Boolean(selectedRecordId),
  });

  const imageQuery = useQuery({
    queryKey: ['task-record-image', selectedRecordId],
    queryFn: () => fetchTaskRecordImage(selectedRecordId as string),
    enabled: Boolean(selectedRecordId),
  });

  const imagePreviewUrl = useMemo(
    () => (imageQuery.data ? URL.createObjectURL(imageQuery.data) : null),
    [imageQuery.data],
  );

  useEffect(
    () => () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    },
    [imagePreviewUrl],
  );

  const handleExport = async () => {
    try {
      const blob = await exportTaskRecords({
        status: statusFilter === 'all' ? undefined : statusFilter,
        strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'task-records.csv';
      link.click();
      URL.revokeObjectURL(objectUrl);
      message.success('CSV 导出成功');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'CSV 导出失败'));
    }
  };

  const records = recordsQuery.data ?? [];
  const detail = recordDetailQuery.data;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          任务记录
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          查看上传任务生成的记录、结构化 JSON 和原图预览，并支持按筛选条件导出 CSV。
        </Paragraph>
      </div>

      <Card
        title="记录列表"
        extra={
          <Space wrap>
            <Select
              size="small"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '已完成', value: 'completed' },
                { label: '失败', value: 'failed' },
              ]}
              style={{ width: 120 }}
            />
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
              style={{ width: 150 }}
            />
            <Button size="small" onClick={handleExport}>
              导出 CSV
            </Button>
          </Space>
        }
      >
        {records.length ? (
          <Table<TaskRecord>
            rowKey="id"
            dataSource={records}
            loading={recordsQuery.isLoading}
            pagination={{ pageSize: 8 }}
            onRow={(record) => ({
              onClick: () => setSelectedRecordId(record.id),
            })}
            columns={[
              {
                title: '时间',
                dataIndex: 'created_at',
                render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
                width: 180,
              },
              {
                title: '策略',
                dataIndex: 'strategy_name',
              },
              {
                title: '文件名',
                dataIndex: 'input_filename',
              },
              {
                title: '模型',
                render: (_, record) => `${record.model_provider} / ${record.model_name}`,
              },
              {
                title: '结果',
                dataIndex: 'result_status',
                render: (value: string) => <Tag color={statusColorMap[value] ?? 'default'}>{value}</Tag>,
              },
              {
                title: '反馈状态',
                dataIndex: 'feedback_status',
              },
            ]}
          />
        ) : (
          <Empty description="暂无任务记录，先去任务中心提交上传任务" />
        )}
      </Card>

      <Drawer
        open={Boolean(selectedRecordId)}
        width={720}
        title="记录详情"
        onClose={() => setSelectedRecordId(null)}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Card size="small" title="原始图片">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt={detail.input_filename}
                      style={{ width: '100%', borderRadius: 12 }}
                    />
                  ) : (
                    <Empty description="图片加载中或不可用" />
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title="基础信息">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text>记录 ID：{detail.id}</Text>
                    <Text>任务 ID：{detail.job_id}</Text>
                    <Text>策略：{detail.strategy_name}</Text>
                    <Text>文件：{detail.input_filename}</Text>
                    <Text>模型：{detail.model_provider} / {detail.model_name}</Text>
                    <Text>耗时：{detail.duration_ms} ms</Text>
                    <Text>结果状态：{detail.result_status}</Text>
                    <Text>反馈状态：{detail.feedback_status}</Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="结构化 JSON">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(detail.normalized_json, null, 2)}
              </pre>
            </Card>

            <Card size="small" title="原始模型响应">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {detail.raw_model_response}
              </pre>
            </Card>

            <Card size="small" title="策略快照">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(detail.strategy_snapshot, null, 2)}
              </pre>
            </Card>
          </Space>
        ) : (
          <Empty description={recordDetailQuery.isLoading ? '记录加载中' : '请选择一条记录'} />
        )}
      </Drawer>
    </Space>
  );
}
