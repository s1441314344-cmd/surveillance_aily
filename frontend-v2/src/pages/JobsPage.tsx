import { PagePlaceholder } from './PagePlaceholder';

export function JobsPage() {
  return (
    <PagePlaceholder
      title="任务中心"
      description="统一承载上传任务、摄像头单次任务和定时任务。"
      bullets={[
        '上传任务：单张、批量',
        '摄像头任务：单次、定时',
        '任务队列状态：queued / running / completed / failed / cancelled',
        '任务详情抽屉与取消能力',
      ]}
      phase="Phase 3"
    />
  );
}
