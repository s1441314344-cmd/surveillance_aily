import type { Camera, CameraStatus, CameraStatusLog } from '@/shared/api/cameras';
import type { CameraStatusSummary } from '@/pages/cameras/cameraCenterStateContracts';

type FilterVisibleCamerasArgs = {
  cameras: Camera[];
  cameraStatusMap: Record<string, CameraStatus>;
  cameraSearch: string;
  alertOnly: boolean;
};

export function buildCameraStatusMap(statuses?: CameraStatus[] | null): Record<string, CameraStatus> {
  const entries = statuses ?? [];
  return entries.reduce<Record<string, CameraStatus>>((acc, status) => {
    acc[status.camera_id] = status;
    return acc;
  }, {});
}

export function filterVisibleCameras({
  cameras,
  cameraStatusMap,
  cameraSearch,
  alertOnly,
}: FilterVisibleCamerasArgs): Camera[] {
  const normalizedSearch = cameraSearch.trim().toLowerCase();
  return cameras.filter((camera) => {
    if (alertOnly && (cameraStatusMap[camera.id]?.alert_status ?? 'normal') === 'normal') {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    const haystack = [camera.name, camera.location, camera.rtsp_url, camera.ip_address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

export function getStatusSummary(
  cameras: Camera[],
  cameraStatusMap: Record<string, CameraStatus>,
): CameraStatusSummary {
  const summary: CameraStatusSummary = {
    online: 0,
    warning: 0,
    offline: 0,
    unknown: 0,
    abnormal: 0,
  };

  for (const camera of cameras) {
    const status = cameraStatusMap[camera.id];
    const connectionStatus = status?.connection_status ?? 'unknown';
    if (connectionStatus in summary) {
      summary[connectionStatus as keyof CameraStatusSummary] += 1;
    } else {
      summary.unknown += 1;
    }
    if ((status?.alert_status ?? 'normal') !== 'normal') {
      summary.abnormal += 1;
    }
  }

  return summary;
}

export function getSelectedCameraStatus(
  cameraStatusMap: Record<string, CameraStatus>,
  selectedCameraId: string | null,
  statusOverride?: CameraStatus | null,
): CameraStatus | null {
  if (!selectedCameraId) {
    return null;
  }
  return statusOverride ?? cameraStatusMap[selectedCameraId] ?? null;
}

export function normalizeStatusLogs(logs?: CameraStatusLog[] | null): CameraStatusLog[] {
  return logs ?? [];
}

export function getPagedStatusLogs(
  logs: CameraStatusLog[],
  statusLogsPage: number,
  pageSize: number,
): CameraStatusLog[] {
  const start = (statusLogsPage - 1) * pageSize;
  return logs.slice(start, start + pageSize);
}
