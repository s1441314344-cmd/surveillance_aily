import { useEffect, useMemo, useRef } from 'react';
import { type SetURLSearchParams } from 'react-router-dom';
import {
  getDesiredCameraIdForUrlSync,
  readCameraIdFromSearch,
  shouldSelectCameraFromQuery,
} from '@/pages/cameras/cameraUrlSyncUtils';

type UseCameraUrlSyncParams = {
  search: string;
  selectedCameraId: string | null;
  effectiveSelectedCameraId: string | null;
  selectCamera: (cameraId: string | null) => void;
  setSearchParams: SetURLSearchParams;
};

export function useCameraUrlSync({
  search,
  selectedCameraId,
  effectiveSelectedCameraId,
  selectCamera,
  setSearchParams,
}: UseCameraUrlSyncParams) {
  const queryCameraId = useMemo(() => readCameraIdFromSearch(search), [search]);
  const selectedCameraIdRef = useRef(selectedCameraId);
  const effectiveSelectedCameraIdRef = useRef(effectiveSelectedCameraId);
  const selectCameraRef = useRef(selectCamera);

  useEffect(() => {
    selectedCameraIdRef.current = selectedCameraId;
  }, [selectedCameraId]);

  useEffect(() => {
    effectiveSelectedCameraIdRef.current = effectiveSelectedCameraId;
  }, [effectiveSelectedCameraId]);

  useEffect(() => {
    selectCameraRef.current = selectCamera;
  }, [selectCamera]);

  useEffect(() => {
    if (
      shouldSelectCameraFromQuery({
        queryCameraId,
        selectedCameraId: selectedCameraIdRef.current,
        effectiveSelectedCameraId: effectiveSelectedCameraIdRef.current,
      })
    ) {
      selectCameraRef.current(queryCameraId);
    }
  }, [queryCameraId]);

  useEffect(() => {
    const desired = getDesiredCameraIdForUrlSync({
      selectedCameraId,
      effectiveSelectedCameraId,
    });
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
