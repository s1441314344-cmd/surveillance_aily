import { useEffect, useMemo } from 'react';
import { type SetURLSearchParams } from 'react-router-dom';
import { CREATE_CAMERA_ID } from '@/pages/cameras/cameraCenterConfig';

type UseCameraUrlSyncParams = {
  search: string;
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
  selectCamera: (cameraId: string | null) => void;
  setSearchParams: SetURLSearchParams;
};

const readCameraIdFromSearch = (search: string) => new URLSearchParams(search).get('cameraId');

export function useCameraUrlSync({
  search,
  selectedCameraId,
  effectiveSelectedCameraId,
  selectCamera,
  setSearchParams,
}: UseCameraUrlSyncParams) {
  const queryCameraId = useMemo(() => readCameraIdFromSearch(search), [search]);

  useEffect(() => {
    if (queryCameraId && queryCameraId !== selectedCameraId && queryCameraId !== effectiveSelectedCameraId) {
      selectCamera(queryCameraId);
    }
  }, [effectiveSelectedCameraId, queryCameraId, selectCamera, selectedCameraId]);

  useEffect(() => {
    const desired = selectedCameraId === CREATE_CAMERA_ID ? null : effectiveSelectedCameraId;
    if ((queryCameraId ?? null) === (desired ?? null)) {
      return;
    }

    const next = new URLSearchParams(search);
    if (desired) {
      next.set('cameraId', desired);
    } else {
      next.delete('cameraId');
    }
    setSearchParams(next, { replace: true });
  }, [effectiveSelectedCameraId, queryCameraId, search, selectedCameraId, setSearchParams]);
}
