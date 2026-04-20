import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CREATE_CAMERA_ID, useCameraCenterState } from '@/pages/cameras/useCameraCenterState';
import { CAMERA_SECTIONS, type CameraSectionKey } from '@/pages/cameras/cameraSections';
import { useCameraUrlSync } from '@/pages/cameras/useCameraUrlSync';

export function useCamerasPageController() {
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

  return {
    forms: {
      form,
      triggerRuleForm,
      monitorConfigForm,
    },
    state: {
      cameraCenterState,
      currentSection,
      pageDescription,
      cameras,
      visibleCameras,
      cameraSearch,
      alertOnly,
      cameraStatusMap,
      statusSummary,
      camerasLoading,
      sweepLoading,
      effectiveSelectedCameraId,
    },
    actions: {
      setCameraSearch,
      setAlertOnly,
      runSweepAllCameras,
      selectCamera,
      navigateToSection,
      handleResetCameraFilters,
      handleCreateCamera,
    },
  };
}
