import { CREATE_CAMERA_ID } from '@/pages/cameras/cameraCenterConfig';

type CameraSelectionPair = {
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
};

export function readCameraIdFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('cameraId');
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
