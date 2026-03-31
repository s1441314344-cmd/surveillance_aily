export const STATUS_BADGE_REGISTRY = {
  generic: {
    active: 'green',
    inactive: 'default',
    enabled: 'green',
    disabled: 'default',
    success: 'green',
    failed: 'red',
    warning: 'orange',
    info: 'blue',
    default: 'default',
  },
  job: {
    queued: 'default',
    running: 'processing',
    completed: 'green',
    failed: 'red',
    cancelled: 'orange',
  },
  result: {
    completed: 'green',
    failed: 'red',
    schema_invalid: 'orange',
  },
  feedback: {
    unreviewed: 'default',
    correct: 'green',
    incorrect: 'red',
  },
  schedule: {
    active: 'green',
    paused: 'orange',
  },
  cameraConnection: {
    online: 'green',
    warning: 'gold',
    offline: 'red',
    unknown: 'default',
  },
  cameraAlert: {
    normal: 'blue',
    warning: 'gold',
    offline: 'red',
    unknown: 'default',
  },
  cameraMediaType: {
    photo: 'blue',
    video: 'purple',
  },
  cameraMediaStatus: {
    pending: 'default',
    recording: 'processing',
    processing: 'processing',
    completed: 'green',
    failed: 'red',
    cancelled: 'orange',
  },
  alertSeverity: {
    critical: 'red',
    high: 'volcano',
    medium: 'gold',
    low: 'blue',
  },
  alertStatus: {
    resolved: 'green',
    acknowledged: 'blue',
    open: 'orange',
  },
} as const;

export type StatusRegistryNamespace = keyof typeof STATUS_BADGE_REGISTRY;

export function getStatusBadgeColor(
  namespace: StatusRegistryNamespace,
  value: string | null | undefined,
): string {
  if (!value) {
    return STATUS_BADGE_REGISTRY.generic.default;
  }
  const scopedRegistry = STATUS_BADGE_REGISTRY[namespace] as Record<string, string>;
  return scopedRegistry[value] ?? STATUS_BADGE_REGISTRY.generic.default;
}
