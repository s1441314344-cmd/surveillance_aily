import { Button, Space } from 'antd';
import {
  ACTIVE_STATUS_LABELS,
  SectionCard,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { StrategyEditorForm } from '@/pages/strategies/StrategyEditorForm';
import { StrategySelectionRail } from '@/pages/strategies/StrategySelectionRail';
import type { useStrategiesPageController } from '@/pages/strategies/useStrategiesPageController';

type StrategiesPageController = ReturnType<typeof useStrategiesPageController>;

type StrategiesWorkspaceSectionProps = {
  controller: StrategiesPageController;
};

export function StrategiesWorkspaceSection({ controller }: StrategiesWorkspaceSectionProps) {
  return (
    <div className="page-grid page-grid--sidebar">
      <StrategySelectionRail
        loading={controller.queries.strategyQuery.isLoading}
        error={controller.queries.strategyError}
        strategies={controller.queries.strategies}
        selectedStrategyId={controller.queries.effectiveSelectedStrategyId}
        statusFilter={controller.statusFilter}
        onStatusFilterChange={controller.setStatusFilter}
        onResetListFilter={controller.handleResetListFilter}
        onSelectStrategy={controller.setSelectedStrategyId}
      />

      <SectionCard
        title={controller.queries.effectiveSelectedStrategyId ? '编辑策略' : '新建策略'}
        subtitle={
          controller.queries.activeStrategy
            ? `${controller.queries.activeStrategy.name} · 当前版本 v${controller.queries.activeStrategy.version}`
            : '填写基础信息、提示词与结果格式'
        }
        actions={
          controller.queries.activeStrategy ? (
            <Space wrap>
              <StatusBadge
                namespace="generic"
                value={controller.queries.activeStrategy.status}
                label={ACTIVE_STATUS_LABELS[controller.queries.activeStrategy.status] ?? UNKNOWN_LABELS.generic}
              />
              <Button
                size="small"
                onClick={controller.handleToggleStrategyStatus}
                loading={controller.mutations.updateStatusMutation.isPending}
              >
                {controller.queries.activeStrategy.status === 'active' ? '停用策略' : '启用策略'}
              </Button>
            </Space>
          ) : null
        }
      >
        <StrategyEditorForm
          form={controller.form}
          providerOptions={controller.providerOptions}
          selectedStrategyId={controller.queries.effectiveSelectedStrategyId}
          submitLoading={controller.actions.submitLoading}
          validateLoading={controller.actions.validateLoading}
          onSubmit={controller.actions.handleSubmit}
          onValidate={() => void controller.actions.handleValidate()}
          onReset={controller.actions.resetForCreate}
        />
      </SectionCard>
    </div>
  );
}
