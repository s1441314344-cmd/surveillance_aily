import { RoutePageHeader } from '@/shared/ui';
import { JobsMainSection } from '@/pages/jobs/JobsMainSection';
import { JobsOverlaySection } from '@/pages/jobs/JobsOverlaySection';
import { useJobsPageController } from '@/pages/jobs/useJobsPageController';

export function JobsPage() {
  const controller = useJobsPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="图片上传、摄像头单次任务和定时计划统一进入异步队列；worker 执行分析，scheduler 触发到期计划。" />
      <JobsMainSection controller={controller} />
      <JobsOverlaySection controller={controller} />
    </div>
  );
}
