import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listCameras, type Camera } from '@/shared/api/configCenter';
import { CREATE_CAMERA_ID } from '@/pages/cameras/cameraCenterConfig';
import {
  buildCameraStatusMap,
  buildMonitorConfigData,
  filterVisibleCameras,
  getActiveCamera,
  getActiveRecordingMedia,
  getEffectiveSelectedCameraId,
  getPagedStatusLogs,
  getSelectedCameraStatus,
  getStatusSummary,
  mapStrategyOptions,
  normalizeStatusLogs,
} from './cameraCenterQueryUtils';
import { CAMERA_QUERY_KEYS } from '@/pages/cameras/cameraQueryKeys';
import { useCameraCenterQueries } from '@/pages/cameras/useCameraCenterQueries';
import { CAMERA_CENTER_QUERY_CONFIG } from '@/pages/cameras/cameraCenterQueryConfig';

type UseCameraCenterQueryStateParams = {
  selectedCameraId: string | null;
  cameraSearch: string;
  alertOnly: boolean;
  statusLogsPage: number;
};

function getQueryArrayData<T>(data: T[] | undefined) {
  return data ?? [];
}

function getCameraIdentifiers(cameras: Camera[]) {
  const cameraIds = cameras.map((camera) => camera.id);
  return {
    cameraIds,
    cameraIdsKey: cameraIds.join(','),
  };
}

function getQueryLoadingState(params: {
  monitorConfigLoading: boolean;
  mediaLoading: boolean;
  triggerRulesLoading: boolean;
  statusLogsLoading: boolean;
  statusLoading: boolean;
  camerasLoading: boolean;
}) {
  return {
    monitorConfigLoading: params.monitorConfigLoading,
    mediaLoading: params.mediaLoading,
    triggerRulesLoading: params.triggerRulesLoading,
    statusLogsLoading: params.statusLogsLoading,
    statusLoading: params.statusLoading,
    camerasLoading: params.camerasLoading,
  };
}

export function useCameraCenterQueryState({
  selectedCameraId,
  cameraSearch,
  alertOnly,
  statusLogsPage,
}: UseCameraCenterQueryStateParams) {
  const statusLogsPageSize = CAMERA_CENTER_QUERY_CONFIG.statusLogsPageSize;

  const cameraQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameras,
    queryFn: listCameras,
  });

  const cameras = getQueryArrayData(cameraQuery.data);
  const { cameraIds, cameraIdsKey } = useMemo(() => getCameraIdentifiers(cameras), [cameras]);

  const effectiveSelectedCameraId = useMemo(
    () =>
      getEffectiveSelectedCameraId({
        selectedCameraId,
        cameras,
        createCameraId: CREATE_CAMERA_ID,
      }),
    [cameras, selectedCameraId],
  );

  const activeCamera = useMemo(
    () => getActiveCamera(cameras, effectiveSelectedCameraId),
    [cameras, effectiveSelectedCameraId],
  );
  const {
    statusQuery,
    statusListQuery,
    statusLogsQuery,
    mediaQuery,
    triggerRulesQuery,
    monitorConfigQuery,
    monitorStrategyQuery,
  } = useCameraCenterQueries({
    effectiveSelectedCameraId,
    cameraIds,
    cameraIdsKey,
  });

  const cameraStatusMap = useMemo(() => buildCameraStatusMap(statusListQuery.data), [
    statusListQuery.data,
  ]);

  const visibleCameras = useMemo(
    () =>
      filterVisibleCameras({
        cameras,
        cameraStatusMap,
        cameraSearch,
        alertOnly,
      }),
    [alertOnly, cameraSearch, cameraStatusMap, cameras],
  );

  const statusSummary = useMemo(
    () => getStatusSummary(cameras, cameraStatusMap),
    [cameraStatusMap, cameras],
  );

  const selectedCameraStatus = useMemo(
    () =>
      getSelectedCameraStatus(
        cameraStatusMap,
        effectiveSelectedCameraId,
        statusQuery.data ?? null,
      ),
    [cameraStatusMap, effectiveSelectedCameraId, statusQuery.data],
  );

  const selectedCameraStatusLogs = useMemo(
    () => normalizeStatusLogs(statusLogsQuery.data),
    [statusLogsQuery.data],
  );

  const pagedStatusLogs = useMemo(
    () => getPagedStatusLogs(selectedCameraStatusLogs, statusLogsPage, statusLogsPageSize),
    [selectedCameraStatusLogs, statusLogsPage, statusLogsPageSize],
  );

  const selectedCameraMedia = getQueryArrayData(mediaQuery.data);
  const selectedCameraTriggerRules = getQueryArrayData(triggerRulesQuery.data);
  const activeRecordingMedia = useMemo(
    () => getActiveRecordingMedia(selectedCameraMedia),
    [selectedCameraMedia],
  );

  const monitorStrategyOptions = useMemo(
    () => mapStrategyOptions(monitorStrategyQuery.data),
    [monitorStrategyQuery.data],
  );

  const monitorConfigData = useMemo(
    () => buildMonitorConfigData(monitorConfigQuery.data),
    [monitorConfigQuery.data],
  );
  const loadingState = getQueryLoadingState({
    monitorConfigLoading: monitorConfigQuery.isLoading,
    mediaLoading: mediaQuery.isLoading,
    triggerRulesLoading: triggerRulesQuery.isLoading,
    statusLogsLoading: statusLogsQuery.isLoading,
    statusLoading: statusQuery.isLoading,
    camerasLoading: cameraQuery.isLoading,
  });

  return {
    cameras,
    effectiveSelectedCameraId,
    activeCamera,
    cameraStatusMap,
    visibleCameras,
    statusSummary,
    selectedCameraStatus,
    selectedCameraStatusLogs,
    pagedStatusLogs,
    statusLogsPageSize,
    selectedCameraMedia,
    selectedCameraTriggerRules,
    activeRecordingMedia,
    monitorStrategyOptions,
    monitorConfig: monitorConfigQuery.data,
    monitorConfigData,
    ...loadingState,
  };
}
