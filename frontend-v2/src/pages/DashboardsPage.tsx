import {
  Button,
} from 'antd';
import {
  PageHeader,
  SectionCard,
} from '@/shared/ui';
import { DashboardDefinitionForm } from '@/pages/dashboards/DashboardDefinitionForm';
import { DashboardDefinitionRail } from '@/pages/dashboards/DashboardDefinitionRail';
import { useDashboardsPageController } from '@/pages/dashboards/useDashboardsPageController';

export function DashboardsPage() {
  const {
    form,
    statusFilter,
    setStatusFilter,
    setSelectedDashboardId,
    queries,
    actions,
    handleResetListFilter,
  } = useDashboardsPageController();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="看板治理"
        title="看板配置"
        description="管理可复用看板定义（布局 JSON + 指标组合），后续拖拽式看板会在此基础上扩展。"
        extra={
          <Button type="primary" onClick={actions.resetForCreate}>
            新建看板
          </Button>
        }
      />

      <div className="page-grid page-grid--sidebar">
        <DashboardDefinitionRail
          loading={queries.dashboardQuery.isLoading}
          error={queries.dashboardError}
          dashboards={queries.dashboards}
          selectedDashboardId={queries.effectiveSelectedDashboardId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onResetListFilter={handleResetListFilter}
          onSelectDashboard={setSelectedDashboardId}
        />

        <SectionCard title={queries.effectiveSelectedDashboardId ? '编辑看板定义' : '新建看板定义'}>
          <DashboardDefinitionForm
            form={form}
            selectedDashboardId={queries.effectiveSelectedDashboardId}
            submitLoading={actions.submitLoading}
            validateLoading={actions.validateLoading}
            deleteLoading={actions.deleteLoading}
            onSubmit={actions.handleSubmit}
            onValidate={() => void actions.handleValidateDefinition()}
            onReset={actions.resetForCreate}
            onDelete={actions.handleDelete}
          />
        </SectionCard>
      </div>
    </div>
  );
}
