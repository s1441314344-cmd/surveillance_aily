import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/shared/api/errors';
import { listCameras, listModelProviders, listStrategies } from '@/shared/api/configCenter';
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

const jobTypeColorMap: Record<string, string> = {
  upload_single: 'blue',
  upload_batch: 'cyan',
  camera_once: 'purple',
  camera_schedule: 'geekblue',
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

export function RecordsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [modelProviderFilter, setModelProviderFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [createdFromFilter, setCreatedFromFilter] = useState<string>('');
  const [createdToFilter, setCreatedToFilter] = useState<string>('');
  const selectedRecordId = searchParams.get('recordId');

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'all-for-records'],
    queryFn: () => listStrategies(),
  });

  const cameraQuery = useQuery({
    queryKey: ['cameras', 'all-for-records'],
    queryFn: () => listCameras(),
  });

  const modelProviderQuery = useQuery({
    queryKey: ['model-providers', 'all-for-records'],
    queryFn: () => listModelProviders(),
  });

  const recordsQuery = useQuery({
    queryKey: [
      'task-records',
      statusFilter,
      strategyFilter,
      cameraFilter,
      modelProviderFilter,
      feedbackFilter,
      createdFromFilter,
      createdToFilter,
    ],
    queryFn: () =>
      listTaskRecords({
        status: statusFilter === 'all' ? undefined : statusFilter,
        strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
        cameraId: cameraFilter === 'all' ? undefined : cameraFilter,
        modelProvider: modelProviderFilter === 'all' ? undefined : modelProviderFilter,
        feedbackStatus: feedbackFilter === 'all' ? undefined : feedbackFilter,
        createdFrom: parseDateFilter(createdFromFilter),
        createdTo: parseDateFilter(createdToFilter),
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

  const handleSelectRecord = (recordId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('recordId', recordId);
    setSearchParams(nextParams, { replace: true });
  };

  const handleCloseDetail = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('recordId');
    setSearchParams(nextParams, { replace: true });
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportTaskRecords({
        format,
        status: statusFilter === 'all' ? undefined : statusFilter,
        strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
        cameraId: cameraFilter === 'all' ? undefined : cameraFilter,
        modelProvider: modelProviderFilter === 'all' ? undefined : modelProviderFilter,
        feedbackStatus: feedbackFilter === 'all' ? undefined : feedbackFilter,
        createdFrom: parseDateFilter(createdFromFilter),
        createdTo: parseDateFilter(createdToFilter),
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = format === 'xlsx' ? 'task-records.xlsx' : 'task-records.csv';
      link.click();
      URL.revokeObjectURL(objectUrl);
      message.success(format === 'xlsx' ? 'Excel 导出成功' : 'CSV 导出成功');
    } catch (error) {
      message.error(getApiErrorMessage(error, format === 'xlsx' ? 'Excel 导出失败' : 'CSV 导出失败'));
    }
  };

  const records = recordsQuery.data ?? [];
  const detail = recordDetailQuery.data;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          任务记录
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          查看上传任务生成的记录、结构化 JSON 和原图预览，并支持按状态/策略/摄像头/模型/反馈/时间导出 CSV/Excel。
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
            <Select
              size="small"
              value={cameraFilter}
              onChange={setCameraFilter}
              options={[
                { label: '全部摄像头', value: 'all' },
                ...(cameraQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                })),
              ]}
              style={{ width: 170 }}
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
            <Select
              size="small"
              value={feedbackFilter}
              onChange={setFeedbackFilter}
              options={[
                { label: '全部反馈状态', value: 'all' },
                { label: '未复核', value: 'unreviewed' },
                { label: '正确', value: 'correct' },
                { label: '错误', value: 'incorrect' },
              ]}
              style={{ width: 140 }}
            />
            <Input
              size="small"
              type="datetime-local"
              value={createdFromFilter}
              onChange={(event) => setCreatedFromFilter(event.target.value)}
              style={{ width: 190 }}
            />
            <Input
              size="small"
              type="datetime-local"
              value={createdToFilter}
              onChange={(event) => setCreatedToFilter(event.target.value)}
              style={{ width: 190 }}
            />
            <Button size="small" onClick={() => handleExport('csv')}>
              导出 CSV
            </Button>
            <Button size="small" onClick={() => handleExport('xlsx')}>
              导出 Excel
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
              onClick: () => handleSelectRecord(record.id),
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
                title: '执行来源',
                render: (_, record) => (
                  <Space size={6}>
                    <Tag color={jobTypeColorMap[record.job_type || ''] ?? 'default'}>
                      {record.job_type || 'unknown'}
                    </Tag>
                    {record.schedule_id ? <Text type="secondary">计划 {record.schedule_id.slice(0, 8)}</Text> : null}
                  </Space>
                ),
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
        size="large"
        title="记录详情"
        extra={
          detail ? (
            <Button size="small" onClick={() => navigate(`/feedback?recordId=${detail.id}`)}>
              去人工复核
            </Button>
          ) : null
        }
        onClose={handleCloseDetail}
      >
        {detail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
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
                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    <Text>记录 ID：{detail.id}</Text>
                    <Text>任务 ID：{detail.job_id}</Text>
                    <Text>任务类型：{detail.job_type || 'unknown'}</Text>
                    <Text>计划 ID：{detail.schedule_id || '无'}</Text>
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
