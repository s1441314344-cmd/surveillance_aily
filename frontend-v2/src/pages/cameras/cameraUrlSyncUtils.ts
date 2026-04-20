import { CREATE_CAMERA_ID } from '@/pages/cameras/cameraCenterConfig';

type CameraSelectionPair = {
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
};

export function normalizeCameraId(cameraId: string | null | undefined): string | null {
  if (cameraId == null) {
    return null;
  }
  const normalized = cameraId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readCameraIdFromSearch(search: string): string | null {
  return normalizeCameraId(new URLSearchParams(search).get('cameraId'));
}

export function shouldSelectCameraFromQuery(params: CameraSelectionPair & { queryCameraId: string | null }): boolean {
  const { queryCameraId, selectedCameraId, effectiveSelectedCameraId } = params;
  if (!queryCameraId) {
    return false;
  }
  return queryCameraId !== selectedCameraId && queryCameraId !== effectiveSelectedCameraId;
}

export function getDesiredCameraIdForUrlSync({
  selectedCameraId,
  effectiveSelectedCameraId,
  createCameraId = CREATE_CAMERA_ID,
}: CameraSelectionPair & { createCameraId?: string }): string | null {
  return selectedCameraId === createCameraId ? null : effectiveSelectedCameraId;
}
