import { PagePlaceholder } from './PagePlaceholder';

export function RecordsPage() {
  return (
    <PagePlaceholder
      title="任务记录"
      description="用于查看任务记录列表、详情、导出和跳转到人工复核。"
      bullets={[
        '多条件筛选：时间、策略、状态、摄像头、模型',
        '详情抽屉：原图、JSON、原始响应、策略快照',
        'CSV 导出',
      ]}
      phase="Phase 4"
    />
  );
}
