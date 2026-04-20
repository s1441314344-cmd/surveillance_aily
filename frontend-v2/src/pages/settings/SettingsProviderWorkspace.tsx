import { DataStateBlock, SectionCard } from '@/shared/ui';
import { ProviderCallLogPanel } from '@/pages/settings/ProviderCallLogPanel';
import { ProviderConfigForm } from '@/pages/settings/ProviderConfigForm';
import { ProviderDebugForm } from '@/pages/settings/ProviderDebugForm';
import { ProviderDebugResultPanel } from '@/pages/settings/ProviderDebugResultPanel';
import { ProviderSelectionRail } from '@/pages/settings/ProviderSelectionRail';
import { TrainingFeedbackPanel } from '@/pages/settings/TrainingFeedbackPanel';
import type { useSettingsPageController } from '@/pages/settings/useSettingsPageController';

type SettingsPageController = ReturnType<typeof useSettingsPageController>;

type SettingsProviderWorkspaceProps = {
  controller: SettingsPageController;
};

export function SettingsProviderWorkspace({ controller }: SettingsProviderWorkspaceProps) {
  const activeProvider = controller.queries.activeProvider;
  const providerSubtitle = activeProvider
    ? `${activeProvider.display_name} · ${activeProvider.provider}`
    : '请选择左侧提供方';
  const isProviderBusy = controller.actions.saveLoading || controller.actions.debugLoading;

  return (
    <div className="page-grid page-grid--sidebar">
      <ProviderSelectionRail
        providers={controller.workspace.filteredProviders}
        selectedProvider={controller.workspace.effectiveSelectedProviderInFilter}
        loading={controller.queries.providerQuery.isLoading}
        error={controller.queries.providerError}
        statusFilter={controller.workspace.statusFilter}
        onStatusFilterChange={controller.workspace.setStatusFilter}
        onResetFilter={controller.workspace.handleResetListFilter}
        onSelectProvider={controller.handleSelectProvider}
      />

      <div className="page-stack">
        <SectionCard
          title="提供方配置"
          subtitle={providerSubtitle}
        >
          <DataStateBlock
            empty={!activeProvider}
            emptyDescription="请选择一个模型提供方后开始配置"
          >
            {activeProvider ? (
              <ProviderConfigForm
                form={controller.form}
                provider={activeProvider}
                onSubmit={(values) => void controller.actions.handleSubmit(values)}
              />
            ) : null}
          </DataStateBlock>
        </SectionCard>

        <SectionCard title="联通调试" subtitle="保存当前配置后，使用同一提供方立即验证请求、返回与结构化输出">
          <DataStateBlock
            empty={!activeProvider}
            emptyDescription="请选择一个模型提供方后开始调试"
          >
            {activeProvider ? (
              <div className="page-stack">
                <ProviderDebugForm
                  form={controller.debugForm}
                  provider={activeProvider}
                  loading={isProviderBusy}
                  onSubmit={() => void controller.actions.handleSaveAndDebug()}
                />

                <ProviderDebugResultPanel result={controller.lastDebugResult} />
              </div>
            ) : null}
          </DataStateBlock>
        </SectionCard>

        <SectionCard title="模型调用记录" subtitle="展示该提供方的模型调用时间、触发类型与实际执行情况，便于排查 token 消耗来源">
          <DataStateBlock
            empty={!activeProvider}
            emptyDescription="请选择一个模型提供方后查看调用记录"
          >
            {activeProvider ? (
              <ProviderCallLogPanel
                logs={controller.queries.modelCallLogs}
                loading={controller.queries.modelCallLogQuery.isLoading}
                error={controller.queries.modelCallLogError}
              />
            ) : null}
          </DataStateBlock>
        </SectionCard>

        <SectionCard
          title="训练回流"
          subtitle="基于人工复核结果自动构建数据集、触发训练/增强、离线评估并进入审批发布。"
        >
          <TrainingFeedbackPanel
            overview={controller.queries.trainingOverview}
            config={controller.queries.trainingConfig}
            datasets={controller.queries.trainingDatasets}
            runs={controller.queries.trainingRuns}
            strategies={controller.queries.trainingStrategies}
            history={controller.queries.trainingHistory}
            loading={
              controller.queries.trainingOverviewQuery.isLoading
              || controller.queries.trainingConfigQuery.isLoading
              || controller.queries.trainingRunsQuery.isLoading
              || controller.queries.trainingDatasetsQuery.isLoading
              || controller.queries.trainingStrategiesQuery.isLoading
              || controller.queries.trainingHistoryQuery.isLoading
            }
            error={controller.queries.trainingError}
          />
        </SectionCard>
      </div>
    </div>
  );
}
