import { Typography } from 'antd';
import {
  DataStateBlock,
  DetailPanel,
  RESULT_STATUS_LABELS,
  SectionCard,
  SOURCE_TYPE_LABELS,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { RecordDetailCard } from '@/pages/insights/RecordDetailCard';
import { type TaskRecord } from '@/shared/api/records';

type RecordDetailSectionProps = {
  detail: TaskRecord | undefined;
  imagePreviewUrl: string | null;
};

export function RecordDetailSection({ detail, imagePreviewUrl }: RecordDetailSectionProps) {
  const hasDetail = Boolean(detail);

  return (
    <SectionCard title="记录详情" className="page-master-detail">
      {hasDetail ? (
        <DetailPanel
          title={`任务 ${detail?.job_id ?? ''}`}
          subtitle={detail?.result_status ? (RESULT_STATUS_LABELS[detail.result_status] ?? UNKNOWN_LABELS.generic) : undefined}
        >
          <div className="record-detail-summary" data-testid="record-detail-summary">
            <Typography.Text>记录 ID：{detail?.id}</Typography.Text>
            <Typography.Text>文件：{detail?.input_filename}</Typography.Text>
            <Typography.Text>结果状态：{detail?.result_status ? (RESULT_STATUS_LABELS[detail.result_status] ?? UNKNOWN_LABELS.generic) : '-'}</Typography.Text>
          </div>
          {detail?.input_image_path ? (
            <RecordDetailCard
              title="原始图片"
              content={
                imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="原图" className="page-image-frame" />
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
            content={<pre className="page-code-block">{JSON.stringify(detail?.normalized_json ?? {}, null, 2)}</pre>}
          />
          <RecordDetailCard
            title="原始模型响应"
            content={<pre className="page-code-block">{detail?.raw_model_response || '-'}</pre>}
          />
          <RecordDetailCard
            title="策略快照"
            content={<pre className="page-code-block">{JSON.stringify(detail?.strategy_snapshot ?? {}, null, 2)}</pre>}
          />
        </DetailPanel>
      ) : (
        <DataStateBlock empty emptyDescription="请选择一条记录，右侧展示详情、JSON 与原始响应。" minHeight={360}>
          <div />
        </DataStateBlock>
      )}
    </SectionCard>
  );
}
