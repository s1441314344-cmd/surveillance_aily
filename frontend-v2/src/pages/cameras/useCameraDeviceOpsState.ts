import type { FormInstance } from 'antd';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import {
  type Camera,
  type CameraDiagnostic,
  type CameraMedia,
} from '@/shared/api/cameras';
import type { CameraFormValues } from '@/pages/cameras/cameraCenterConfig';
import { useCameraDeviceMutations } from '@/pages/cameras/useCameraDeviceMutations';
import { buildCameraPayload } from '@/pages/cameras/cameraDevicePayload';

type UseCameraDeviceOpsStateParams = {
  activeCamera: Camera | null;
  effectiveSelectedCameraId: string | null;
  cameras: Camera[];
  form: FormInstance<CameraFormValues>;
  recordDurationSeconds: number;
  activeRecordingMedia: CameraMedia | null;
  onSelectCamera: (cameraId: string | null) => void;
  onDiagnosticResult: (diagnostic: CameraDiagnostic) => void;
};

function runIfPresent<T>(value: T | null | undefined, action: (present: T) => void) {
  if (value) {
    action(value);
  }
}

export function useCameraDeviceOpsState({
  activeCamera,
  effectiveSelectedCameraId,
  cameras,
  form,
  recordDurationSeconds,
  activeRecordingMedia,
  onSelectCamera,
  onDiagnosticResult,
}: UseCameraDeviceOpsStateParams) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const {
    createMutation,
    updateMutation,
    deleteMutation,
    checkMutation,
    sweepMutation,
    diagnoseMutation,
    capturePhotoMutation,
    startRecordingMutation,
    stopRecordingMutation,
    deleteMediaMutation,
  } = useCameraDeviceMutations({
    message,
    queryClient,
    form,
    onSelectCamera,
    onDiagnosticResult,
  });

  const submitCamera = async (values: CameraFormValues, targetCameraId: string | null) => {
    const payload = buildCameraPayload(values);

    if (targetCameraId) {
      await updateMutation.mutateAsync({ cameraId: targetCameraId, payload });
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  const runSweepAllCameras = () => {
    runIfPresent(cameras.length ? cameras : null, (items) =>
      sweepMutation.mutate(items.map((item) => item.id)),
    );
  };

  const deleteSelectedCamera = () => {
    runIfPresent(activeCamera, (camera) => deleteMutation.mutate(camera.id));
  };

  const checkSelectedCamera = () => {
    runIfPresent(activeCamera, (camera) => checkMutation.mutate(camera.id));
  };

  const diagnoseSelectedCamera = () => {
    runIfPresent(activeCamera, (camera) => diagnoseMutation.mutate(camera.id));
  };

  const captureSelectedCameraPhoto = () => {
    runIfPresent(effectiveSelectedCameraId, (cameraId) => capturePhotoMutation.mutate(cameraId));
  };

  const startSelectedCameraRecording = () => {
    runIfPresent(effectiveSelectedCameraId, (cameraId) =>
      startRecordingMutation.mutate({
        cameraId,
        durationSeconds: recordDurationSeconds,
      }),
    );
  };

  const stopSelectedCameraRecording = () => {
    if (effectiveSelectedCameraId && activeRecordingMedia) {
      stopRecordingMutation.mutate({
        cameraId: effectiveSelectedCameraId,
        mediaId: activeRecordingMedia.id,
      });
    }
  };

  const deleteMediaItem = (mediaId: string) => {
    runIfPresent(effectiveSelectedCameraId, (cameraId) =>
      deleteMediaMutation.mutate({
        cameraId,
        mediaId,
      }),
    );
  };

  return {
    createOrUpdateCameraLoading: createMutation.isPending || updateMutation.isPending,
    deleteCameraLoading: deleteMutation.isPending,
    checkCameraLoading: checkMutation.isPending,
    sweepLoading: sweepMutation.isPending,
    diagnoseLoading: diagnoseMutation.isPending,
    capturePhotoLoading: capturePhotoMutation.isPending,
    startRecordingLoading: startRecordingMutation.isPending,
    stopRecordingLoading: stopRecordingMutation.isPending,
    deleteMediaLoading: deleteMediaMutation.isPending,
    submitCamera,
    deleteSelectedCamera,
    checkSelectedCamera,
    diagnoseSelectedCamera,
    runSweepAllCameras,
    captureSelectedCameraPhoto,
    startSelectedCameraRecording,
    stopSelectedCameraRecording,
    deleteMediaItem,
  };
}
