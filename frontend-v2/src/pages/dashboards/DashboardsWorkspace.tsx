import { SectionCard } from '@/shared/ui';
import { DashboardDefinitionForm } from '@/pages/dashboards/DashboardDefinitionForm';
import { DashboardDefinitionRail } from '@/pages/dashboards/DashboardDefinitionRail';
import type { useDashboardsPageController } from '@/pages/dashboards/useDashboardsPageController';

type DashboardsPageController = ReturnType<typeof useDashboardsPageController>;

type DashboardsWorkspaceProps = {
  controller: DashboardsPageController;
};

export function DashboardsWorkspace({ controller }: DashboardsWorkspaceProps) {
  return (
    <div className="page-grid page-grid--sidebar">
      <DashboardDefinitionRail
        loading={controller.queries.dashboardQuery.isLoading}
        error={controller.queries.dashboardError}
        dashboards={controller.queries.dashboards}
        selectedDashboardId={controller.queries.effectiveSelectedDashboardId}
        statusFilter={controller.statusFilter}
        onStatusFilterChange={controller.setStatusFilter}
        onResetListFilter={controller.handleResetListFilter}
        onSelectDashboard={controller.setSelectedDashboardId}
      />

      <SectionCard title={controller.queries.effectiveSelectedDashboardId ? '编辑看板定义' : '新建看板定义'}>
        <DashboardDefinitionForm
          form={controller.form}
          selectedDashboardId={controller.queries.effectiveSelectedDashboardId}
          submitLoading={controller.actions.submitLoading}
          validateLoading={controller.actions.validateLoading}
          deleteLoading={controller.actions.deleteLoading}
          onSubmit={controller.actions.handleSubmit}
          onValidate={() => void controller.actions.handleValidateDefinition()}
          onReset={controller.actions.resetForCreate}
          onDelete={controller.actions.handleDelete}
        />
      </SectionCard>
    </div>
  );
}
