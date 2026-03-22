import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Radio,
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
  createFeedback,
  fetchTaskRecordImage,
  getTaskRecord,
  listFeedback,
  listTaskRecords,
  TaskRecord,
  updateFeedback,
} from '@/shared/api/tasks';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;

type FeedbackFormValues = {
  judgement: 'correct' | 'incorrect';
  correctedLabel?: string;
  comment?: string;
};

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

export function FeedbackPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FeedbackFormValues>();
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>('unreviewed');
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const strategyQuery = useQuery({
    queryKey: ['strategies', 'all-for-feedback'],
    queryFn: () => listStrategies(),
  });

  const recordsQuery = useQuery({
    queryKey: ['task-records', 'feedback', feedbackStatusFilter, strategyFilter],
    queryFn: () =>
      listTaskRecords({
        strategyId: strategyFilter === 'all' ? undefined : strategyFilter,
        feedbackStatus: feedbackStatusFilter === 'all' ? undefined : feedbackStatusFilter,
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

  const feedbackQuery = useQuery({
    queryKey: ['feedback-record', selectedRecordId],
    queryFn: () => listFeedback({ recordId: selectedRecordId as string }),
    enabled: Boolean(selectedRecordId),
  });

  const selectedRecord = recordDetailQuery.data ?? null;
  const currentFeedback = useMemo(() => feedbackQuery.data?.[0] ?? null, [feedbackQuery.data]);
  const records = recordsQuery.data ?? [];

  useEffect(() => {
    if (!records.length) {
      setSelectedRecordId(null);
      return;
    }

    const hasSelectedRecord = selectedRecordId && records.some((item) => item.id === selectedRecordId);
    if (!hasSelectedRecord) {
      setSelectedRecordId(records[0].id);
    }
  }, [records, selectedRecordId]);

  useEffect(() => {
    if (!imageQuery.data) {
      setImagePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageQuery.data);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageQuery.data]);

  useEffect(() => {
    if (!selectedRecordId) {
      form.resetFields();
      return;
    }

    if (currentFeedback) {
      form.setFieldsValue({
        judgement: currentFeedback.judgement as FeedbackFormValues['judgement'],
        correctedLabel: currentFeedback.corrected_label ?? undefined,
        comment: currentFeedback.comment ?? undefined,
      });
      return;
    }

    form.resetFields();
  }, [currentFeedback, form, selectedRecordId]);

  const invalidateReviewData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-records'] }),
      queryClient.invalidateQueries({ queryKey: ['task-record-detail', selectedRecordId] }),
      queryClient.invalidateQueries({ queryKey: ['feedback-record', selectedRecordId] }),
    ]);
  };

  const reviewMutation = useMutation({
    mutationFn: async (values: FeedbackFormValues) => {
      if (!selectedRecordId) {
        throw new Error('missing-record-id');
      }

      if (currentFeedback) {
        return updateFeedback(currentFeedback.id, {
          judgement: values.judgement,
          correctedLabel: values.correctedLabel,
          comment: values.comment,
        });
      }

      return createFeedback({
        recordId: selectedRecordId,
        judgement: values.judgement,
        correctedLabel: values.correctedLabel,
        comment: values.comment,
      });
    },
    onSuccess: async () => {
      await invalidateReviewData();
      message.success(currentFeedback ? '复核结果已更新' : '复核结果已提交');
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '提交复核结果失败'));
    },
  });

  const handleSubmit = async (values: FeedbackFormValues) => {
    await reviewMutation.mutateAsync(values);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          人工复核
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          面向待复核记录进行图片与结构化结果对照，支持正确/错误标记、修正标签和备注沉淀。
        </Paragraph>
      </div>

      <Row gutter={16} align="stretch">
        <Col xs={24} xl={10}>
          <Card
            title="待复核队列"
            extra={
              <Space wrap>
                <Select
                  size="small"
                  value={feedbackStatusFilter}
                  onChange={setFeedbackStatusFilter}
                  options={[
                    { label: '待复核', value: 'unreviewed' },
                    { label: '全部记录', value: 'all' },
                    { label: '已判定正确', value: 'correct' },
                    { label: '已判定错误', value: 'incorrect' },
                  ]}
                  style={{ width: 130 }}
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
              </Space>
            }
          >
            {records.length ? (
              <Table<TaskRecord>
                rowKey="id"
                dataSource={records}
                loading={recordsQuery.isLoading}
                pagination={{ pageSize: 8 }}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedRecordId(record.id),
                })}
                columns={[
                  {
                    title: '时间',
                    dataIndex: 'created_at',
                    width: 170,
                    render: (value: string | null) => (value ? new Date(value).toLocaleString() : '-'),
                  },
                  {
                    title: '策略',
                    dataIndex: 'strategy_name',
                    ellipsis: true,
                  },
                  {
                    title: '结果',
                    dataIndex: 'result_status',
                    width: 110,
                    render: (value: string) => (
                      <Tag color={resultStatusColorMap[value] ?? 'default'}>{value}</Tag>
                    ),
                  },
                  {
                    title: '反馈',
                    dataIndex: 'feedback_status',
                    width: 110,
                    render: (value: string) => (
                      <Tag color={feedbackStatusColorMap[value] ?? 'default'}>{value}</Tag>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="当前筛选条件下暂无可复核记录" />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="复核详情">
              {selectedRecord ? (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Card size="small" title="原始图片">
                        {imagePreviewUrl ? (
                          <img
                            src={imagePreviewUrl}
                            alt={selectedRecord.input_filename}
                            style={{ width: '100%', borderRadius: 12 }}
                          />
                        ) : (
                          <Empty description="图片加载中或不可用" />
                        )}
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Card size="small" title="记录摘要">
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Text>记录 ID：{selectedRecord.id}</Text>
                          <Text>任务 ID：{selectedRecord.job_id}</Text>
                          <Text>策略：{selectedRecord.strategy_name}</Text>
                          <Text>文件名：{selectedRecord.input_filename}</Text>
                          <Text>
                            模型：{selectedRecord.model_provider} / {selectedRecord.model_name}
                          </Text>
                          <Text>耗时：{selectedRecord.duration_ms} ms</Text>
                          <Text>
                            结果状态：
                            <Tag
                              color={resultStatusColorMap[selectedRecord.result_status] ?? 'default'}
                              style={{ marginLeft: 8 }}
                            >
                              {selectedRecord.result_status}
                            </Tag>
                          </Text>
                          <Text>
                            反馈状态：
                            <Tag
                              color={feedbackStatusColorMap[selectedRecord.feedback_status] ?? 'default'}
                              style={{ marginLeft: 8 }}
                            >
                              {selectedRecord.feedback_status}
                            </Tag>
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  </Row>

                  <Card size="small" title="结构化 JSON">
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(selectedRecord.normalized_json, null, 2)}
                    </pre>
                  </Card>

                  <Card size="small" title="原始模型响应">
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {selectedRecord.raw_model_response}
                    </pre>
                  </Card>
                </Space>
              ) : (
                <Empty description={recordsQuery.isLoading ? '记录加载中' : '请选择一条待复核记录'} />
              )}
            </Card>

            <Card
              title="复核标记"
              extra={
                currentFeedback ? (
                  <Text type="secondary">
                    最近复核：{currentFeedback.reviewer}
                    {currentFeedback.created_at
                      ? ` · ${new Date(currentFeedback.created_at).toLocaleString()}`
                      : ''}
                  </Text>
                ) : null
              }
            >
              {selectedRecord ? (
                <Form<FeedbackFormValues> layout="vertical" form={form} onFinish={handleSubmit}>
                  <Form.Item
                    label="复核结论"
                    name="judgement"
                    rules={[{ required: true, message: '请选择复核结论' }]}
                  >
                    <Radio.Group
                      optionType="button"
                      buttonStyle="solid"
                      options={[
                        { label: '正确', value: 'correct' },
                        { label: '错误', value: 'incorrect' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item label="修正标签" name="correctedLabel">
                    <Input placeholder="例如 no_fire、no_helmet、ocr_unclear" />
                  </Form.Item>

                  <Form.Item label="备注" name="comment">
                    <TextArea
                      rows={4}
                      placeholder="补充人工判断依据、现场信息或后续处理建议"
                      showCount
                      maxLength={300}
                    />
                  </Form.Item>

                  <Space>
                    <Button type="primary" htmlType="submit" loading={reviewMutation.isPending}>
                      {currentFeedback ? '更新复核结果' : '提交复核结果'}
                    </Button>
                    <Button onClick={() => form.resetFields()}>重置表单</Button>
                  </Space>
                </Form>
              ) : (
                <Empty description="请选择一条记录后再进行复核" />
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
