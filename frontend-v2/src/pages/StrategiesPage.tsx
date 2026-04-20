import { RoutePageHeader } from '@/shared/ui';
import { StrategiesHeaderActions } from '@/pages/strategies/StrategiesHeaderActions';
import { StrategiesWorkspaceSection } from '@/pages/strategies/StrategiesWorkspaceSection';
import { useStrategiesPageController } from '@/pages/strategies/useStrategiesPageController';

export function StrategiesPage() {
  const controller = useStrategiesPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader
        description="统一管理场景描述、提示词模板、目标模型与输出格式，收敛为可维护的策略版本。"
        extra={<StrategiesHeaderActions controller={controller} />}
      />
      <StrategiesWorkspaceSection controller={controller} />
    </div>
  );
}
