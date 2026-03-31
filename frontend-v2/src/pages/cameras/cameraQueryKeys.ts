export const CAMERA_QUERY_KEYS = {
  cameras: ['cameras'] as const,
  cameraStatusRoot: ['camera-status'] as const,
  cameraStatus: (cameraId?: string | null) => ['camera-status', cameraId ?? ''] as const,
  cameraStatuses: ['camera-statuses'] as const,
  cameraStatusesByIds: (cameraIdsKey: string) => ['camera-statuses', cameraIdsKey] as const,
  cameraStatusLogsRoot: ['camera-status-logs'] as const,
  cameraStatusLogs: (cameraId?: string | null) => ['camera-status-logs', cameraId ?? ''] as const,
  cameraMediaRoot: ['camera-media'] as const,
  cameraMedia: (cameraId?: string | null) => ['camera-media', cameraId ?? ''] as const,
  cameraTriggerRulesRoot: ['camera-trigger-rules'] as const,
  cameraTriggerRules: (cameraId?: string | null) => ['camera-trigger-rules', cameraId ?? ''] as const,
  cameraSignalMonitorConfigRoot: ['camera-signal-monitor-config'] as const,
  cameraSignalMonitorConfig: (cameraId?: string | null) =>
    ['camera-signal-monitor-config', cameraId ?? ''] as const,
  monitorConfigOptions: ['strategies', 'monitor-config-options'] as const,
};

export const CAMERA_INVALIDATION_KEYS = {
  core: [
    CAMERA_QUERY_KEYS.cameras,
    CAMERA_QUERY_KEYS.cameraStatusRoot,
    CAMERA_QUERY_KEYS.cameraStatuses,
    CAMERA_QUERY_KEYS.cameraStatusLogsRoot,
    CAMERA_QUERY_KEYS.cameraMediaRoot,
    CAMERA_QUERY_KEYS.cameraTriggerRulesRoot,
    CAMERA_QUERY_KEYS.cameraSignalMonitorConfigRoot,
  ] as const,
};
