import { CREATE_CAMERA_ID, type CameraFormValues } from '@/pages/cameras/cameraCenterConfig';
import type { CameraCenterState, CameraListContext } from '@/pages/cameras/cameraCenterTypes';
import type { useCameraCenterLocalState } from '@/pages/cameras/useCameraCenterLocalState';
import type { useCameraCenterQueryState } from '@/pages/cameras/useCameraCenterQueryState';
import type { useCameraMediaState } from '@/pages/cameras/useCameraMediaState';
import type { useCameraMonitoringRuleState } from '@/pages/cameras/useCameraMonitoringRuleState';
import type { useCameraDeviceOpsState } from '@/pages/cameras/useCameraDeviceOpsState';

type LocalState = Omit<ReturnType<typeof useCameraCenterLocalState>, 'setSelectedCameraId'> & {
  setSelectedCameraId: (cameraId: string | null) => void;
};
type QueryState = ReturnType<typeof useCameraCenterQueryState>;
type MediaState = ReturnType<typeof useCameraMediaState>;
type MonitoringRuleState = ReturnType<typeof useCameraMonitoringRuleState>;
type DeviceOpsState = ReturnType<typeof useCameraDeviceOpsState>;

type AssembleCameraCenterStateParams = {
  localState: LocalState;
  queryState: QueryState;
  mediaState: MediaState;
  monitoringRuleState: MonitoringRuleState;
  deviceOpsState: DeviceOpsState;
  cameraListContext: CameraListContext;
  handleSubmit: (values: CameraFormValues) => Promise<void>;
};

function getIsCreateMode(selectedCameraId: string | null, effectiveSelectedCameraId: string | null) {
  return selectedCameraId === CREATE_CAMERA_ID || !effectiveSelectedCameraId;
}

function buildViewState({
  localState,
  queryState,
  mediaState,
  monitoringRuleState,
  cameraListContext,
  isCreateMode,
}: {
  localState: LocalState;
  queryState: QueryState;
  mediaState: MediaState;
  monitoringRuleState: MonitoringRuleState;
  cameraListContext: CameraListContext;
  isCreateMode: boolean;
}) {
  const {
    selectedCameraId,
    form,
    triggerRuleForm,
    monitorConfigForm,
    cameraSearch,
    setCameraSearch,
    alertOnly,
    setAlertOnly,
    statusLogsPage,
    setStatusLogsPage,
    recordDurationSeconds,
    setRecordDurationSeconds,
    diagnosticModalOpen,
    setDiagnosticModalOpen,
    lastDiagnostic,
  } = localState;
  const { effectiveSelectedCameraId, activeCamera } = queryState;
  const {
    cameras,
    visibleCameras,
    cameraStatusMap,
    statusSummary,
    selectedCameraStatus,
    selectedCameraStatusLogs,
    pagedStatusLogs,
    statusLogsPageSize,
    selectedCameraMedia,
    selectedCameraTriggerRules,
    activeRecordingMedia,
    monitorStrategyOptions,
    monitorConfigData,
  } = queryState;
  const {
    thumbnailUrls,
    previewOpen,
    previewMedia,
    previewUrl,
    closePreview,
    handlePreviewMedia,
    recordingCountdown,
  } = mediaState;
  const {
    triggerRuleModalOpen,
    setTriggerRuleModalOpen,
    editingTriggerRule,
    debugSignalsJson,
    setDebugSignalsJson,
    debugConsecutiveJson,
    setDebugConsecutiveJson,
    triggerDebugDryRun,
    setTriggerDebugDryRun,
    triggerDebugCaptureOnMatch,
    setTriggerDebugCaptureOnMatch,
    triggerDebugResult,
    liveDebugResult,
  } = monitoringRuleState;

  return {
    form,
    triggerRuleForm,
    monitorConfigForm,
    selectedCameraId,
    effectiveSelectedCameraId,
    activeCamera,
    isCreateMode,
    cameras,
    visibleCameras,
    cameraSearch,
    setCameraSearch,
    alertOnly,
    setAlertOnly,
    cameraListContext,
    cameraStatusMap,
    statusSummary,
    selectedCameraStatus,
    selectedCameraStatusLogs,
    pagedStatusLogs,
    statusLogsPage,
    setStatusLogsPage,
    statusLogsPageSize,
    selectedCameraMedia,
    selectedCameraTriggerRules,
    activeRecordingMedia,
    recordDurationSeconds,
    setRecordDurationSeconds,
    thumbnailUrls,
    previewOpen,
    previewMedia,
    previewUrl,
    closePreview,
    handlePreviewMedia,
    diagnosticModalOpen,
    setDiagnosticModalOpen,
    lastDiagnostic,
    triggerRuleModalOpen,
    setTriggerRuleModalOpen,
    editingTriggerRule,
    debugSignalsJson,
    setDebugSignalsJson,
    debugConsecutiveJson,
    setDebugConsecutiveJson,
    triggerDebugDryRun,
    setTriggerDebugDryRun,
    triggerDebugCaptureOnMatch,
    setTriggerDebugCaptureOnMatch,
    triggerDebugResult,
    liveDebugResult,
    recordingCountdown,
    monitorStrategyOptions,
    monitorConfigData,
  };
}

function buildLoadingState({
  queryState,
  deviceOpsState,
  monitoringRuleState,
}: {
  queryState: QueryState;
  deviceOpsState: DeviceOpsState;
  monitoringRuleState: MonitoringRuleState;
}) {
  const {
    monitorConfigLoading,
    mediaLoading,
    triggerRulesLoading,
    statusLogsLoading,
    statusLoading,
    camerasLoading,
  } = queryState;
  const {
    createOrUpdateCameraLoading,
    deleteCameraLoading,
    checkCameraLoading,
    sweepLoading,
    diagnoseLoading,
    capturePhotoLoading,
    startRecordingLoading,
    stopRecordingLoading,
    deleteMediaLoading,
  } = deviceOpsState;
  const {
    createOrUpdateRuleLoading,
    deleteRuleLoading,
    debugRuleLoading,
    saveMonitorConfigLoading,
    toggleMonitorLoading,
    liveDebugLoading,
  } = monitoringRuleState;

  return {
    monitorConfigLoading,
    mediaLoading,
    triggerRulesLoading,
    statusLogsLoading,
    statusLoading,
    camerasLoading,
    createOrUpdateCameraLoading,
    deleteCameraLoading,
    checkCameraLoading,
    sweepLoading,
    diagnoseLoading,
    capturePhotoLoading,
    startRecordingLoading,
    stopRecordingLoading,
    deleteMediaLoading,
    createOrUpdateRuleLoading,
    deleteRuleLoading,
    debugRuleLoading,
    saveMonitorConfigLoading,
    toggleMonitorLoading,
    liveDebugLoading,
  };
}

function buildActionState({
  localState,
  deviceOpsState,
  monitoringRuleState,
  handleSubmit,
}: {
  localState: LocalState;
  deviceOpsState: DeviceOpsState;
  monitoringRuleState: MonitoringRuleState;
  handleSubmit: (values: CameraFormValues) => Promise<void>;
}) {
  const { setSelectedCameraId, resetForCreate } = localState;
  const {
    deleteSelectedCamera,
    checkSelectedCamera,
    diagnoseSelectedCamera,
    runSweepAllCameras,
    captureSelectedCameraPhoto,
    startSelectedCameraRecording,
    stopSelectedCameraRecording,
    deleteMediaItem,
  } = deviceOpsState;
  const {
    openCreateTriggerRuleModal,
    openEditTriggerRuleModal,
    closeTriggerRuleModal,
    handleSubmitTriggerRule,
    deleteTriggerRule,
    runTriggerRulesDebug,
    runLiveDebug,
    submitMonitorConfig,
    toggleMonitorEnabled,
  } = monitoringRuleState;

  return {
    selectCamera: setSelectedCameraId,
    resetForCreate,
    handleSubmit,
    deleteSelectedCamera,
    checkSelectedCamera,
    diagnoseSelectedCamera,
    runSweepAllCameras,
    captureSelectedCameraPhoto,
    startSelectedCameraRecording,
    stopSelectedCameraRecording,
    deleteMediaItem,
    openCreateTriggerRuleModal,
    openEditTriggerRuleModal,
    closeTriggerRuleModal,
    handleSubmitTriggerRule,
    deleteTriggerRule,
    runTriggerRulesDebug,
    runLiveDebug,
    submitMonitorConfig,
    toggleMonitorEnabled,
  };
}

export function assembleCameraCenterState({
  localState,
  queryState,
  mediaState,
  monitoringRuleState,
  deviceOpsState,
  cameraListContext,
  handleSubmit,
}: AssembleCameraCenterStateParams): CameraCenterState {
  const isCreateMode = getIsCreateMode(
    localState.selectedCameraId,
    queryState.effectiveSelectedCameraId,
  );
  const viewState = buildViewState({
    localState,
    queryState,
    mediaState,
    monitoringRuleState,
    cameraListContext,
    isCreateMode,
  });
  const loadingState = buildLoadingState({
    queryState,
    deviceOpsState,
    monitoringRuleState,
  });
  const actionState = buildActionState({
    localState,
    deviceOpsState,
    monitoringRuleState,
    handleSubmit,
  });

  return {
    ...viewState,
    ...loadingState,
    ...actionState,
  };
}
