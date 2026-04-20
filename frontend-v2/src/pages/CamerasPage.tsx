import { Form } from 'antd';
import { Outlet } from 'react-router-dom';
import { CameraSidebarPanel } from '@/pages/cameras/CameraSidebarPanel';
import { CameraSectionTabs } from '@/pages/cameras/CameraSectionTabs';
import { useCamerasPageController } from '@/pages/cameras/useCamerasPageController';
import { RoutePageHeader } from '@/shared/ui';

export function CamerasPage() {
  const { forms, state, actions } = useCamerasPageController();

  return (
    <div className="page-stack">
      <Form form={forms.form} component={false} />
      <Form form={forms.monitorConfigForm} component={false} />
      <Form form={forms.triggerRuleForm} component={false} />

      <RoutePageHeader
        routePath="/cameras"
        description={state.pageDescription}
        extra={
          <CameraSectionTabs currentValue={state.currentSection} onChange={actions.navigateToSection} />
        }
      />

      <div className="page-grid page-grid--sidebar">
        <CameraSidebarPanel
          cameras={state.cameras}
          visibleCameras={state.visibleCameras}
          cameraSearch={state.cameraSearch}
          alertOnly={state.alertOnly}
          cameraStatusMap={state.cameraStatusMap}
          statusSummary={state.statusSummary}
          camerasLoading={state.camerasLoading}
          sweepLoading={state.sweepLoading}
          effectiveSelectedCameraId={state.effectiveSelectedCameraId}
          onCameraSearchChange={actions.setCameraSearch}
          onAlertOnlyChange={actions.setAlertOnly}
          onRunSweepAllCameras={actions.runSweepAllCameras}
          onCreateCamera={actions.handleCreateCamera}
          onSelectCamera={actions.selectCamera}
          onResetFilters={actions.handleResetCameraFilters}
        />

        <div className="page-stack">
          <Outlet context={state.cameraCenterState} />
        </div>
      </div>
    </div>
  );
}
