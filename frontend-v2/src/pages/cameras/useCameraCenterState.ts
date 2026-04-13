import { App } from 'antd';
import { useCallback } from 'react';
import { getApiErrorMessage } from '@/shared/api/errors';
import type { CameraDiagnostic } from '@/shared/api/configCenter';
import type {
  CameraFormValues,
} from '@/pages/cameras/cameraCenterConfig';
import type { CameraCenterState, CameraListContext } from '@/pages/cameras/cameraCenterTypes';
import { useCameraCenterQueryState } from '@/pages/cameras/useCameraCenterQueryState';
import { useCameraCenterLocalState } from '@/pages/cameras/useCameraCenterLocalState';
import { useCameraDeviceOpsState } from '@/pages/cameras/useCameraDeviceOpsState';
import { useCameraFormSync } from '@/pages/cameras/useCameraFormSync';
import { useCameraMediaState } from '@/pages/cameras/useCameraMediaState';
import { useCameraMonitoringRuleState } from '@/pages/cameras/useCameraMonitoringRuleState';
import { useCameraSelectionState } from '@/pages/cameras/useCameraSelectionState';
import {
  useClampStatusLogsPage,
  useResetStatusLogsPageOnCameraChange,
} from '@/pages/cameras/cameraCenterStateHelpers';
import { assembleCameraCenterState } from '@/pages/cameras/cameraCenterStateAssembler';

export {
  CREATE_CAMERA_ID,
  DEFAULT_CAMERA_VALUES,
  DEFAULT_MONITOR_CONFIG_VALUES,
  DEFAULT_TRIGGER_RULE_VALUES,
  RUNTIME_MODE_LABELS,
  RUNTIME_MODE_OPTIONS,
  SCHEDULE_TYPE_OPTIONS,
  STATUS_COLOR_MAP,
} from '@/pages/cameras/cameraCenterConfig';
export type {
  CameraFormValues,
  MonitorConfigFormValues,
  TriggerRuleFormValues,
} from '@/pages/cameras/cameraCenterConfig';
export type { CameraCenterState, CameraListContext } from '@/pages/cameras/cameraCenterTypes';

function buildCameraListContext(params: {
  queryState: ReturnType<typeof useCameraCenterQueryState>;
  localState: ReturnType<typeof useCameraCenterLocalState>;
  deviceOpsState: ReturnType<typeof useCameraDeviceOpsState>;
  selectionState: ReturnType<typeof useCameraSelectionState>;
}): CameraListContext {
  const { queryState, localState, deviceOpsState, selectionState } = params;
  return {
    cameras: queryState.cameras,
    visibleCameras: queryState.visibleCameras,
    cameraSearch: localState.cameraSearch,
    setCameraSearch: localState.setCameraSearch,
    alertOnly: localState.alertOnly,
    setAlertOnly: localState.setAlertOnly,
    cameraStatusMap: queryState.cameraStatusMap,
    statusSummary: queryState.statusSummary,
    camerasLoading: queryState.camerasLoading,
    sweepLoading: deviceOpsState.sweepLoading,
    runSweepAllCameras: deviceOpsState.runSweepAllCameras,
    selectCamera: selectionState.selectCamera,
  };
}

export function useCameraCenterState(initialSelectedCameraId?: string | null): CameraCenterState {
  const { message } = App.useApp();
  const localState = useCameraCenterLocalState(initialSelectedCameraId);
  const handlePreviewError = useCallback(
    (error: unknown) => {
      message.error(getApiErrorMessage(error, '媒体预览加载失败'));
    },
    [message],
  );
  const handleDiagnosticResult = (diagnostic: CameraDiagnostic) => {
    localState.setLastDiagnostic(diagnostic);
    localState.setDiagnosticModalOpen(true);
  };

  const queryState = useCameraCenterQueryState({
    selectedCameraId: localState.selectedCameraId,
    cameraSearch: localState.cameraSearch,
    alertOnly: localState.alertOnly,
    statusLogsPage: localState.statusLogsPage,
  });
  const selectionState = useCameraSelectionState({
    selectedCameraId: localState.selectedCameraId,
    effectiveSelectedCameraId: queryState.effectiveSelectedCameraId,
    setSelectedCameraId: localState.setSelectedCameraId,
  });
  const mediaState = useCameraMediaState({
    cameraId: selectionState.effectiveSelectedCameraId,
    mediaItems: queryState.selectedCameraMedia,
    activeRecordingMedia: queryState.activeRecordingMedia,
    onPreviewError: handlePreviewError,
  });
  const monitoringRuleState = useCameraMonitoringRuleState({
    cameraId: selectionState.effectiveSelectedCameraId,
    monitorConfig: queryState.monitorConfig,
    triggerRuleForm: localState.triggerRuleForm,
    monitorConfigForm: localState.monitorConfigForm,
  });
  const deviceOpsState = useCameraDeviceOpsState({
    activeCamera: queryState.activeCamera,
    effectiveSelectedCameraId: selectionState.effectiveSelectedCameraId,
    cameras: queryState.cameras,
    form: localState.form,
    recordDurationSeconds: localState.recordDurationSeconds,
    activeRecordingMedia: queryState.activeRecordingMedia,
    onSelectCamera: selectionState.selectCamera,
    onDiagnosticResult: handleDiagnosticResult,
  });

  useCameraFormSync({
    activeCamera: queryState.activeCamera,
    form: localState.form,
  });

  useResetStatusLogsPageOnCameraChange(
    selectionState.effectiveSelectedCameraId,
    localState.setStatusLogsPage,
  );
  useClampStatusLogsPage(
    queryState.selectedCameraStatusLogs.length,
    localState.statusLogsPage,
    queryState.statusLogsPageSize,
    localState.setStatusLogsPage,
  );

  const handleSubmit = async (values: CameraFormValues) => {
    await deviceOpsState.submitCamera(values, selectionState.effectiveSelectedCameraId);
  };

  const cameraListContext = buildCameraListContext({
    queryState,
    localState,
    deviceOpsState,
    selectionState,
  });

  const localStateForAssembly = {
    ...localState,
    selectedCameraId: selectionState.selectedCameraId,
    setSelectedCameraId: selectionState.selectCamera,
  };
  const queryStateForAssembly = {
    ...queryState,
    effectiveSelectedCameraId: selectionState.effectiveSelectedCameraId,
  };

  return assembleCameraCenterState({
    localState: localStateForAssembly,
    queryState: queryStateForAssembly,
    mediaState,
    monitoringRuleState,
    deviceOpsState,
    cameraListContext,
    handleSubmit,
  });
}
