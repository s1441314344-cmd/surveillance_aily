import { Button, Drawer, Image, Space, Typography } from 'antd';
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
import { formatDateTime } from '@/pages/jobs/jobsTableFormatters';
import { useJobDetailDrawerState } from '@/pages/jobs/useJobDetailDrawerState';

const { Paragraph, Text } = Typography;

type JobDetailDrawerModalProps = {
  open: boolean;
};

type JobDetailDrawerDataProps = {
  job?: JobDetailViewModel | null;
};

type JobDetailDrawerHandlersProps = {
  onClose: () => void;
};

export type JobDetailDrawerProps = {
  modal: JobDetailDrawerModalProps;
  data: JobDetailDrawerDataProps;
  handlers: JobDetailDrawerHandlersProps;
};

export function JobDetailDrawer({ modal, data, handlers }: JobDetailDrawerProps) {
  const drawer = useJobDetailDrawerState({
    open: modal.open,
    job: data.job,
  });

  const job = data.job;
  const handleOpenRecordImage = () => {
    if (!drawer.recordImageUrl) {
      return;
    }
    window.open(drawer.recordImageUrl, '_blank', 'noopener,noreferrer');
  };

  if (!job) {
    return (
      <Drawer
        open={modal.open}
        title="任务详情"
        placement="right"
        size="large"
        onClose={handlers.onClose}
      >
        <Paragraph>请选择一条任务以查看详情。</Paragraph>
      </Drawer>
    );
  }

  return (
    <Drawer
      open={modal.open}
      title={`任务详情 · ${job.id}`}
      placement="right"
      size="large"
      onClose={handlers.onClose}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} className="stack-full">
        <DetailPanel title="基础信息">
          <Space orientation="vertical" size={4} className="stack-full">
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
          <Space orientation="vertical" size={4} className="stack-full">
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
          <Space orientation="vertical" size={4} className="stack-full">
            <Text>
              关联记录：
              {drawer.recordsQuery.isLoading ? '加载中...' : `${drawer.recordsQuery.data?.length ?? 0} 条`}
            </Text>
            <Space size={8} wrap>
              <Text>结果：</Text>
              {drawer.resultStatusValue ? (
                <StatusBadge
                  namespace="result"
                  value={drawer.resultStatusValue}
                  label={RESULT_STATUS_LABELS[drawer.resultStatusValue] ?? UNKNOWN_LABELS.generic}
                />
              ) : <Text>-</Text>}
            </Space>
            <Space size={8} wrap>
              <Text>反馈：</Text>
              {drawer.feedbackStatusValue ? (
                <StatusBadge
                  namespace="feedback"
                  value={drawer.feedbackStatusValue}
                  label={FEEDBACK_STATUS_LABELS[drawer.feedbackStatusValue] ?? UNKNOWN_LABELS.generic}
                />
              ) : <Text>-</Text>}
            </Space>
            {drawer.latestRecord ? (
              <Text type="secondary">
                最近记录：{drawer.latestRecord.input_filename} · {formatDateTime(drawer.latestRecord.created_at)}
              </Text>
            ) : null}
          </Space>
        </DetailPanel>

        <DetailPanel title="图片预览">
          {!drawer.latestRecord ? (
            <Text type="secondary">暂无关联记录图片</Text>
          ) : drawer.recordImageQuery.isLoading ? (
            <Text type="secondary">图片加载中...</Text>
          ) : drawer.recordImageUrl ? (
            <Space orientation="vertical" size={8} className="stack-full">
              <Image
                src={drawer.recordImageUrl}
                alt={drawer.latestRecord.input_filename}
                className="local-detector-preview__image"
              />
              <Button
                size="small"
                onClick={handleOpenRecordImage}
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
            {drawer.normalizedJsonValue ? JSON.stringify(drawer.normalizedJsonValue, null, 2) : '暂无结构化结果'}
          </pre>
        </DetailPanel>

        <DetailPanel title="原始模型响应">
          <Paragraph
            className="page-code-block"
            copyable={drawer.rawResponseValue ? { text: drawer.rawResponseValue } : false}
          >
            {drawer.rawResponseValue || '暂无原始响应'}
          </Paragraph>
        </DetailPanel>
      </Space>
    </Drawer>
  );
}
