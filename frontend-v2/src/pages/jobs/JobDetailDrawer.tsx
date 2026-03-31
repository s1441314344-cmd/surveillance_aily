import { Drawer, Space, Typography } from 'antd';
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
          </Space>
        </DetailPanel>

        <DetailPanel title="结果概览">
          <Space direction="vertical" size={4} className="stack-full">
            <Space size={8} wrap>
              <Text>结果：</Text>
              {job.result_status ? (
                <StatusBadge
                  namespace="result"
                  value={job.result_status}
                  label={RESULT_STATUS_LABELS[job.result_status] ?? UNKNOWN_LABELS.generic}
                />
              ) : <Text>-</Text>}
            </Space>
            <Space size={8} wrap>
              <Text>反馈：</Text>
              {job.feedback_status ? (
                <StatusBadge
                  namespace="feedback"
                  value={job.feedback_status}
                  label={FEEDBACK_STATUS_LABELS[job.feedback_status] ?? UNKNOWN_LABELS.generic}
                />
              ) : <Text>-</Text>}
            </Space>
          </Space>
        </DetailPanel>

        <DetailPanel title="结构化 JSON">
          <pre className="page-code-block">
            {job.normalized_json ? JSON.stringify(job.normalized_json, null, 2) : '-'}
          </pre>
        </DetailPanel>

        <DetailPanel title="原始模型响应">
          <Paragraph className="page-code-block" copyable={job.raw_model_response ? { text: job.raw_model_response } : false}>
            {job.raw_model_response ? job.raw_model_response : '暂无原始响应'}
          </Paragraph>
        </DetailPanel>
      </Space>
    </Drawer>
  );
}
