import { RoutePageHeader } from '@/shared/ui';
import { FeedbackFiltersSection } from '@/pages/feedback/FeedbackFiltersSection';
import { FeedbackWorkspaceSection } from '@/pages/feedback/FeedbackWorkspaceSection';
import { useFeedbackPageController } from '@/pages/feedback/useFeedbackPageController';

export function FeedbackPage() {
  const controller = useFeedbackPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="结合图片与结构化 JSON 进行正确/错误判断，并记录修正信息。" />
      <FeedbackFiltersSection controller={controller} />
      <FeedbackWorkspaceSection controller={controller} />
    </div>
  );
}
