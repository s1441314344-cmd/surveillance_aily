import { RoutePageHeader } from '@/shared/ui';
import { LocalDetectorConfigSection } from '@/pages/local-detector/LocalDetectorConfigSection';
import { LocalDetectorDebugSection } from '@/pages/local-detector/LocalDetectorDebugSection';
import { LocalDetectorHealthSection } from '@/pages/local-detector/LocalDetectorHealthSection';
import { LocalDetectorHistorySection } from '@/pages/local-detector/LocalDetectorHistorySection';
import { LocalDetectorResultSection } from '@/pages/local-detector/LocalDetectorResultSection';
import { useLocalDetectorPageController } from '@/pages/local-detector/useLocalDetectorPageController';

export function LocalDetectorPage() {
  const controller = useLocalDetectorPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="用于检查 local-detector 服务健康状态，并通过单图调试快速验证“人员前置门控”是否命中。" />

      <LocalDetectorHealthSection controller={controller} />
      <LocalDetectorConfigSection controller={controller} />

      <div className="page-grid page-grid--two">
        <LocalDetectorDebugSection controller={controller} />
        <LocalDetectorResultSection controller={controller} />
      </div>

      <LocalDetectorHistorySection controller={controller} />
    </div>
  );
}
