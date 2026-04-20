import { useQuery } from '@tanstack/react-query';
import {
  getCameraStatus,
  getSignalMonitorConfig,
  listCameraMedia,
  listCameraStatusLogs,
  listCameraStatuses,
  listCameraTriggerRules,
} from '@/shared/api/cameras';
import { listStrategies } from '@/shared/api/strategies';
import { CAMERA_QUERY_KEYS } from '@/pages/cameras/cameraQueryKeys';
import { CAMERA_CENTER_QUERY_CONFIG } from '@/pages/cameras/cameraCenterQueryConfig';

type UseCameraCenterQueriesParams = {
  effectiveSelectedCameraId: string | null;
  cameraIds: string[];
  cameraIdsKey: string;
};

export function useCameraCenterQueries({
  effectiveSelectedCameraId,
  cameraIds,
  cameraIdsKey,
}: UseCameraCenterQueriesParams) {
  const statusQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameraStatus(effectiveSelectedCameraId),
    queryFn: () => getCameraStatus(effectiveSelectedCameraId as string),
    enabled: Boolean(effectiveSelectedCameraId),
    refetchInterval: CAMERA_CENTER_QUERY_CONFIG.statusRefreshMs,
  });

  const statusListQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameraStatusesByIds(cameraIdsKey),
    queryFn: () => listCameraStatuses({ cameraIds }),
    enabled: cameraIds.length > 0,
    refetchInterval: CAMERA_CENTER_QUERY_CONFIG.statusRefreshMs,
  });

  const statusLogsQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameraStatusLogs(effectiveSelectedCameraId),
    queryFn: () => listCameraStatusLogs(effectiveSelectedCameraId as string, { limit: 80 }),
    enabled: Boolean(effectiveSelectedCameraId),
    refetchInterval: CAMERA_CENTER_QUERY_CONFIG.statusRefreshMs,
  });

  const mediaQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameraMedia(effectiveSelectedCameraId),
    queryFn: () => listCameraMedia(effectiveSelectedCameraId as string, { limit: 40 }),
    enabled: Boolean(effectiveSelectedCameraId),
    refetchInterval: CAMERA_CENTER_QUERY_CONFIG.mediaRefreshMs,
  });

  const triggerRulesQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameraTriggerRules(effectiveSelectedCameraId),
    queryFn: () => listCameraTriggerRules(effectiveSelectedCameraId as string),
    enabled: Boolean(effectiveSelectedCameraId),
  });

  const monitorConfigQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.cameraSignalMonitorConfig(effectiveSelectedCameraId),
    queryFn: () => getSignalMonitorConfig(effectiveSelectedCameraId as string),
    enabled: Boolean(effectiveSelectedCameraId),
    refetchInterval: CAMERA_CENTER_QUERY_CONFIG.monitorConfigRefreshMs,
  });

  const monitorStrategyQuery = useQuery({
    queryKey: CAMERA_QUERY_KEYS.monitorConfigOptions,
    queryFn: () => listStrategies({ status: 'active' }),
  });

  return {
    statusQuery,
    statusListQuery,
    statusLogsQuery,
    mediaQuery,
    triggerRulesQuery,
    monitorConfigQuery,
    monitorStrategyQuery,
  };
}
