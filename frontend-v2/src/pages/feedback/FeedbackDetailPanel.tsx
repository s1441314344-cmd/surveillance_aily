import {
  DataStateBlock,
  DetailPanel,
  RESULT_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { type TaskRecord } from '@/shared/api/records';
import { RecordDetailCard } from '@/pages/insights/RecordDetailCard';

type FeedbackDetailPanelProps = {
  detail: TaskRecord | null;
  imagePreviewUrl: string | null;
};

export function FeedbackDetailPanel({ detail, imagePreviewUrl }: FeedbackDetailPanelProps) {
  if (!detail) {
    return <DataStateBlock empty emptyDescription="请选择待复核记录" />;
  }

  return (
    <DetailPanel
      title={`任务 ${detail.job_id}`}
      subtitle={RESULT_STATUS_LABELS[detail.result_status] ?? UNKNOWN_LABELS.generic}
    >
      <div className="record-detail-summary" data-testid="feedback-detail-summary">
        <span>记录 ID：{detail.id}</span>
        <span>文件：{detail.input_filename}</span>
        <span>结果状态：{RESULT_STATUS_LABELS[detail.result_status] ?? UNKNOWN_LABELS.generic}</span>
      </div>
      {detail.input_image_path ? (
        <RecordDetailCard
          title="原始图片"
          content={
            imagePreviewUrl ? (
              <img src={imagePreviewUrl} alt="record" className="page-image-frame" />
            ) : (
              <DataStateBlock loading minHeight={140}>
                <></>
              </DataStateBlock>
            )
          }
          secondary={`任务来源：${SOURCE_TYPE_LABELS[detail.source_type] ?? UNKNOWN_LABELS.generic}`}
        />
      ) : null}
      <RecordDetailCard
        title="结构化 JSON"
        content={<pre className="page-code-block">{JSON.stringify(detail.normalized_json ?? {}, null, 2)}</pre>}
      />
      <RecordDetailCard
        title="原始模型响应"
        content={<pre className="page-code-block">{detail.raw_model_response || '-'}</pre>}
      />
      <RecordDetailCard
        title="策略快照"
        content={<pre className="page-code-block">{JSON.stringify(detail.strategy_snapshot ?? {}, null, 2)}</pre>}
      />
    </DetailPanel>
  );
}
