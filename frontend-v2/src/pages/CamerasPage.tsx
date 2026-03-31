import { useCallback, useMemo } from 'react';
import { Form } from 'antd';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CREATE_CAMERA_ID, useCameraCenterState } from '@/pages/cameras/useCameraCenterState';
import { CameraSidebarPanel } from '@/pages/cameras/CameraSidebarPanel';
import { CameraSectionTabs } from '@/pages/cameras/CameraSectionTabs';
import { CAMERA_SECTIONS, type CameraSectionKey } from '@/pages/cameras/cameraSections';
import { useCameraUrlSync } from '@/pages/cameras/useCameraUrlSync';
import { PageHeader } from '@/shared/ui';

export function CamerasPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cameraCenterState = useCameraCenterState(searchParams.get('cameraId'));
  const {
    form,
    triggerRuleForm,
    monitorConfigForm,
    selectedCameraId,
    effectiveSelectedCameraId,
    cameraListContext,
  } = cameraCenterState;
  const {
    cameras,
    visibleCameras,
    cameraSearch,
    setCameraSearch,
    alertOnly,
    setAlertOnly,
    cameraStatusMap,
    statusSummary,
    camerasLoading,
    sweepLoading,
    runSweepAllCameras,
    selectCamera,
  } = cameraListContext;

  const currentSection = useMemo<CameraSectionKey>(() => {
    const matched = CAMERA_SECTIONS.find((item) => location.pathname.endsWith(`/${item.key}`));
    return (matched?.key ?? 'devices') as CameraSectionKey;
  }, [location.pathname]);

  const selectedSection = CAMERA_SECTIONS.find((item) => item.key === currentSection) ?? CAMERA_SECTIONS[0];
  const pageDescription = `${selectedSection.label}：${selectedSection.description}`;

  useCameraUrlSync({
    search: location.search,
    selectedCameraId,
    effectiveSelectedCameraId,
    selectCamera,
    setSearchParams,
  });

  const navigateToSection = useCallback(
    (key: CameraSectionKey) => {
      const next = new URLSearchParams(location.search);
      navigate({ pathname: `/cameras/${key}`, search: next.toString() ? `?${next.toString()}` : '' });
    },
    [location.search, navigate],
  );

  const handleResetCameraFilters = useCallback(() => {
    setCameraSearch('');
    setAlertOnly(false);
  }, [setAlertOnly, setCameraSearch]);

  const handleCreateCamera = useCallback(() => {
    navigate(`/cameras/devices?cameraId=${CREATE_CAMERA_ID}`);
  }, [navigate]);

  return (
    <div className="page-stack">
      <Form form={form} component={false} />
      <Form form={monitorConfigForm} component={false} />
      <Form form={triggerRuleForm} component={false} />

      <PageHeader
        eyebrow="设备运维"
        title="摄像头中心"
        description={pageDescription}
        extra={
          <CameraSectionTabs currentValue={currentSection} onChange={navigateToSection} />
        }
      />

      <div className="page-grid page-grid--sidebar">
        <CameraSidebarPanel
          cameras={cameras}
          visibleCameras={visibleCameras}
          cameraSearch={cameraSearch}
          alertOnly={alertOnly}
          cameraStatusMap={cameraStatusMap}
          statusSummary={statusSummary}
          camerasLoading={camerasLoading}
          sweepLoading={sweepLoading}
          effectiveSelectedCameraId={effectiveSelectedCameraId}
          onCameraSearchChange={setCameraSearch}
          onAlertOnlyChange={setAlertOnly}
          onRunSweepAllCameras={runSweepAllCameras}
          onCreateCamera={handleCreateCamera}
          onSelectCamera={selectCamera}
          onResetFilters={handleResetCameraFilters}
        />

        <div className="page-stack">
          <Outlet context={cameraCenterState} />
        </div>
      </div>
    </div>
  );
}
