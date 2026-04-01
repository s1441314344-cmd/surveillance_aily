import { Button, Drawer, Image, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DetailPanel,
  FEEDBACK_STATUS_LABELS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  RESULT_STATUS_LABELS,
  StatusBadge,
  TRIGGER_MODE_LABELS,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import type { JobDetailViewModel } from '@/pages/jobs/jobDetailMapper';
import { fetchTaskRecordImage, listTaskRecords, type TaskRecord } from '@/shared/api/tasks';

const { Paragraph, Text } = Typography;

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

export type JobDetailDrawerProps = {
  open: boolean;
  job?: JobDetailViewModel | null;
  onClose: () => void;
};

export function JobDetailDrawer({ open, job, onClose }: JobDetailDrawerProps) {
  const [recordImageUrl, setRecordImageUrl] = useState<string | null>(null);

  const recordsQuery = useQuery({
    queryKey: ['jobs', 'detail', job?.id, 'task-records'],
    queryFn: async () => listTaskRecords({ jobId: job?.id }),
    enabled: Boolean(open && job?.id),
  });

  const latestRecord = useMemo<TaskRecord | null>(() => {
    const records = recordsQuery.data;
    if (!records || records.length === 0) {
      return null;
    }
    return [...records].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })[0] ?? null;
  }, [recordsQuery.data]);

  const recordImageQuery = useQuery({
    queryKey: ['jobs', 'detail', job?.id, 'task-record-image', latestRecord?.id],
    queryFn: async () => {
      if (!latestRecord?.id) {
        return null;
      }
      return fetchTaskRecordImage(latestRecord.id);
    },
    enabled: Boolean(open && latestRecord?.id),
  });

  useEffect(() => {
    if (!recordImageQuery.data) {
      setRecordImageUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(recordImageQuery.data);
    setRecordImageUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [recordImageQuery.data]);

  const resultStatusValue = job?.result_status ?? latestRecord?.result_status;
  const feedbackStatusValue = job?.feedback_status ?? latestRecord?.feedback_status;
  const normalizedJsonValue = job?.normalized_json ?? latestRecord?.normalized_json ?? null;
  const rawResponseValue = job?.raw_model_response ?? latestRecord?.raw_model_response ?? '';

  if (!job) {
    return (
      <Drawer open={open} title="任务详情" placement="right" size="large" onClose={onClose}>
        <Paragraph>请选择一条任务以查看详情。</Paragraph>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={open}
      title={`任务详情 · ${job.id}`}
      placement="right"
      size="large"
      onClose={onClose}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} className="stack-full">
        <DetailPanel title="基础信息">
          <Space direction="vertical" size={4} className="stack-full">
            <Text strong>状态</Text>
            <StatusBadge namespace="job" value={job.status} label={JOB_STATUS_LABELS[job.status] ?? UNKNOWN_LABELS.generic} />
            <Text strong>策略</Text>
            <Text>{job.strategy_name || '-'}</Text>
            <Text strong>模型提供方</Text>
            <Text>{job.model_provider || UNKNOWN_LABELS.provider}</Text>
            <Text strong>任务类型</Text>
            <Text>{job.job_type ? (JOB_TYPE_LABELS[job.job_type] ?? UNKNOWN_LABELS.generic) : '-'}</Text>
            <Text strong>触发方式</Text>
            <Text>{job.trigger_mode ? (TRIGGER_MODE_LABELS[job.trigger_mode] ?? UNKNOWN_LABELS.generic) : '-'}</Text>
            {job.camera_id ? (
              <>
                <Text strong>摄像头</Text>
                <Text>{job.camera_id}</Text>
              </>
            ) : null}
            {job.schedule_id ? (
              <>
                <Text strong>计划 ID</Text>
                <Text>{job.schedule_id}</Text>
              </>
            ) : null}
          </Space>
        </DetailPanel>

        <DetailPanel title="执行时间">
          <Space direction="vertical" size={4} className="stack-full">
            <Text>创建时间：{formatDateTime(job.created_at)}</Text>
            <Text>开始时间：{formatDateTime(job.triggered_at)}</Text>
            <Text>完成时间：{formatDateTime(job.finished_at)}</Text>
            <Text>耗时：{job.duration_ms ? `${Math.round(job.duration_ms / 1000)}s` : '-'}</Text>
            <Text>总条目：{job.total_items ?? '-'}</Text>
            <Text>完成条目：{job.completed_items ?? '-'}</Text>
            <Text>失败条目：{job.failed_items ?? '-'}</Text>
            {job.error_message ? <Text type="danger">失败原因：{job.error_message}</Text> : null}
          </Space>
        </DetailPanel>

        <DetailPanel title="结果概览">
          <Space direction="vertical" size={4} className="stack-full">
            <Text>关联记录：{recordsQuery.isLoading ? '加载中...' : `${recordsQuery.data?.length ?? 0} 条`}</Text>
            <Space size={8} wrap>
              <Text>结果：</Text>
              {resultStatusValue ? (
                <StatusBadge
                  namespace="result"
                  value={resultStatusValue}
                  label={RESULT_STATUS_LABELS[resultStatusValue] ?? UNKNOWN_LABELS.generic}
                />
              ) : <Text>-</Text>}
            </Space>
            <Space size={8} wrap>
              <Text>反馈：</Text>
              {feedbackStatusValue ? (
                <StatusBadge
                  namespace="feedback"
                  value={feedbackStatusValue}
                  label={FEEDBACK_STATUS_LABELS[feedbackStatusValue] ?? UNKNOWN_LABELS.generic}
                />
              ) : <Text>-</Text>}
            </Space>
            {latestRecord ? (
              <Text type="secondary">
                最近记录：{latestRecord.input_filename} · {formatDateTime(latestRecord.created_at)}
              </Text>
            ) : null}
          </Space>
        </DetailPanel>

        <DetailPanel title="图片预览">
          {!latestRecord ? (
            <Text type="secondary">暂无关联记录图片</Text>
          ) : recordImageQuery.isLoading ? (
            <Text type="secondary">图片加载中...</Text>
          ) : recordImageUrl ? (
            <Space direction="vertical" size={8} className="stack-full">
              <Image
                src={recordImageUrl}
                alt={latestRecord.input_filename}
                className="local-detector-preview__image"
              />
              <Button
                size="small"
                onClick={() => {
                  window.open(recordImageUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                新窗口查看原图
              </Button>
            </Space>
          ) : (
            <Text type="secondary">暂无可预览图片</Text>
          )}
        </DetailPanel>

        <DetailPanel title="结构化 JSON">
          <pre className="page-code-block">
            {normalizedJsonValue ? JSON.stringify(normalizedJsonValue, null, 2) : '暂无结构化结果'}
          </pre>
        </DetailPanel>

        <DetailPanel title="原始模型响应">
          <Paragraph className="page-code-block" copyable={rawResponseValue ? { text: rawResponseValue } : false}>
            {rawResponseValue || '暂无原始响应'}
          </Paragraph>
        </DetailPanel>
      </Space>
    </Drawer>
  );
}
