import { useCallback, useMemo } from 'react';
import { getDesiredCameraIdForUrlSync } from '@/pages/cameras/cameraUrlSyncUtils';

type UseCameraSelectionStateParams = {
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
  setSelectedCameraId: (cameraId: string | null) => void;
};

export function useCameraSelectionState({
  selectedCameraId,
  effectiveSelectedCameraId,
  setSelectedCameraId,
}: UseCameraSelectionStateParams) {
  const selectCamera = useCallback(
    (cameraId: string | null) => {
      setSelectedCameraId(cameraId);
    },
    [setSelectedCameraId],
  );

  const desiredCameraIdForUrl = useMemo(
    () =>
      getDesiredCameraIdForUrlSync({
        selectedCameraId,
        effectiveSelectedCameraId,
      }),
    [effectiveSelectedCameraId, selectedCameraId],
  );

  return {
    selectedCameraId,
    effectiveSelectedCameraId,
    desiredCameraIdForUrl,
    selectCamera,
  };
}
