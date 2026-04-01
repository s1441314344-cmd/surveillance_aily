import {
  Button,
  Space,
  Typography,
} from 'antd';
import {
  ACTIVE_STATUS_LABELS,
  DataStateBlock,
  PageHeader,
  SectionCard,
  StatusBadge,
  UNKNOWN_LABELS,
} from '@/shared/ui';
import { ProviderDebugForm } from '@/pages/settings/ProviderDebugForm';
import { ProviderConfigForm } from '@/pages/settings/ProviderConfigForm';
import { ProviderSelectionRail } from '@/pages/settings/ProviderSelectionRail';
import { ProviderDebugResultPanel } from '@/pages/settings/ProviderDebugResultPanel';
import { ProviderCallLogPanel } from '@/pages/settings/ProviderCallLogPanel';
import { TrainingFeedbackPanel } from '@/pages/settings/TrainingFeedbackPanel';
import { useSettingsPageController } from '@/pages/settings/useSettingsPageController';

const { Paragraph } = Typography;

export function SettingsPage() {
  const {
    form,
    debugForm,
    lastDebugResult,
    queries,
    actions,
    workspace,
    handleSelectProvider,
  } = useSettingsPageController();
  const activeProvider = queries.activeProvider;
  const isProviderBusy = actions.saveLoading || actions.debugLoading;
  const providerSubtitle = activeProvider
    ? `${activeProvider.display_name} · ${activeProvider.provider}`
    : '请选择左侧提供方';

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="模型与系统"
        title="模型与系统设置"
        description="统一管理 OpenAI、Google Gemini、智谱、豆包/火山方舟等模型提供方，并在保存后直接执行联通性调试。"
        extra={
          activeProvider ? (
            <Space wrap>
              <StatusBadge
                namespace="generic"
                value={activeProvider.status}
                label={ACTIVE_STATUS_LABELS[activeProvider.status] ?? UNKNOWN_LABELS.generic}
              />
              <Button onClick={() => void form.submit()} loading={actions.saveLoading}>
                保存配置
              </Button>
              <Button type="primary" onClick={() => void actions.handleSaveAndDebug()} loading={isProviderBusy}>
                保存并调试
              </Button>
            </Space>
          ) : null
        }
      />

      <SectionCard
        title="接入说明"
        subtitle="本页只维护服务端 API 配置，不依赖 ChatGPT Plus 等网页登录态。"
      >
        <Paragraph className="page-paragraph-bottomless">
          `OpenAI` 维护标准 API 地址与模型，`豆包/火山方舟` 继续走 `ark` 提供方，`Google` 对应 Gemini API。
          调试结果会保留本次请求日志、输入摘要、原始输出和结构化结果，方便判断链路是否真正打通。
        </Paragraph>
      </SectionCard>

      <div className="page-grid page-grid--sidebar">
        <ProviderSelectionRail
          providers={workspace.filteredProviders}
          selectedProvider={workspace.effectiveSelectedProviderInFilter}
          loading={queries.providerQuery.isLoading}
          error={queries.providerError}
          statusFilter={workspace.statusFilter}
          onStatusFilterChange={workspace.setStatusFilter}
          onResetFilter={workspace.handleResetListFilter}
          onSelectProvider={handleSelectProvider}
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
                  form={form}
                  provider={activeProvider}
                  onSubmit={(values) => void actions.handleSubmit(values)}
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
                    form={debugForm}
                    provider={activeProvider}
                    loading={isProviderBusy}
                    onSubmit={() => void actions.handleSaveAndDebug()}
                  />

                  <ProviderDebugResultPanel result={lastDebugResult} />
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
                  logs={queries.modelCallLogs}
                  loading={queries.modelCallLogQuery.isLoading}
                  error={queries.modelCallLogError}
                />
              ) : null}
            </DataStateBlock>
          </SectionCard>

          <SectionCard
            title="训练回流"
            subtitle="基于人工复核结果自动构建数据集、触发训练/增强、离线评估并进入审批发布。"
          >
            <TrainingFeedbackPanel
              provider={activeProvider?.provider ?? null}
              overview={queries.trainingOverview}
              datasets={queries.trainingDatasets}
              runs={queries.trainingRuns}
              loading={
                queries.trainingOverviewQuery.isLoading
                || queries.trainingRunsQuery.isLoading
                || queries.trainingDatasetsQuery.isLoading
              }
              error={queries.trainingError}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
