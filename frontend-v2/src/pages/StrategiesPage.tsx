import {
  Button,
  Space,
} from 'antd';
import {
  ACTIVE_STATUS_LABELS,
  PageHeader,
  SectionCard,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { StrategyEditorForm } from '@/pages/strategies/StrategyEditorForm';
import { StrategySelectionRail } from '@/pages/strategies/StrategySelectionRail';
import { useStrategiesPageController } from '@/pages/strategies/useStrategiesPageController';

export function StrategiesPage() {
  const {
    form,
    statusFilter,
    setStatusFilter,
    setSelectedStrategyId,
    queries,
    mutations,
    actions,
    providerOptions,
    handleResetListFilter,
    handleToggleStrategyStatus,
  } = useStrategiesPageController();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="策略配置"
        title="策略中心"
        description="统一管理场景描述、提示词模板、目标模型与输出格式，收敛为可维护的策略版本。"
        extra={
          <Button type="primary" onClick={actions.resetForCreate}>
            新建策略
          </Button>
        }
      />

      <div className="page-grid page-grid--sidebar">
        <StrategySelectionRail
          loading={queries.strategyQuery.isLoading}
          error={queries.strategyError}
          strategies={queries.strategies}
          selectedStrategyId={queries.effectiveSelectedStrategyId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onResetListFilter={handleResetListFilter}
          onSelectStrategy={setSelectedStrategyId}
        />

        <SectionCard
          title={queries.effectiveSelectedStrategyId ? '编辑策略' : '新建策略'}
          subtitle={queries.activeStrategy ? `${queries.activeStrategy.name} · 当前版本 v${queries.activeStrategy.version}` : '填写基础信息、提示词与结果格式'}
          actions={
            queries.activeStrategy ? (
              <Space wrap>
                <StatusBadge
                  namespace="generic"
                  value={queries.activeStrategy.status}
                  label={ACTIVE_STATUS_LABELS[queries.activeStrategy.status] ?? UNKNOWN_LABELS.generic}
                />
                <Button
                  size="small"
                  onClick={handleToggleStrategyStatus}
                  loading={mutations.updateStatusMutation.isPending}
                >
                  {queries.activeStrategy.status === 'active' ? '停用策略' : '启用策略'}
                </Button>
              </Space>
            ) : null
          }
        >
          <StrategyEditorForm
            form={form}
            providerOptions={providerOptions}
            selectedStrategyId={queries.effectiveSelectedStrategyId}
            submitLoading={actions.submitLoading}
            validateLoading={actions.validateLoading}
            onSubmit={actions.handleSubmit}
            onValidate={() => void actions.handleValidate()}
            onReset={actions.resetForCreate}
          />
        </SectionCard>
      </div>
    </div>
  );
}
