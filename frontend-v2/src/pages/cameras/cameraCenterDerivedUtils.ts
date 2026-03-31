import type { Camera, CameraMedia, SignalMonitorConfig, Strategy } from '@/shared/api/configCenter';
import type { StrategyOption } from '@/pages/cameras/cameraCenterTypes';

type ResolveSelectedCameraArgs = {
  selectedCameraId: string | null;
  cameras: Camera[];
  createCameraId: string;
};

export function getEffectiveSelectedCameraId({
  selectedCameraId,
  cameras,
  createCameraId,
}: ResolveSelectedCameraArgs): string | null {
  if (selectedCameraId === createCameraId) {
    return null;
  }

  const exists = Boolean(selectedCameraId && cameras.some((item) => item.id === selectedCameraId));
  return exists ? selectedCameraId : cameras[0]?.id ?? null;
}

export function getActiveCamera(cameras: Camera[], selectedCameraId: string | null): Camera | null {
  return cameras.find((item) => item.id === selectedCameraId) ?? null;
}

export function getActiveRecordingMedia(media: CameraMedia[]): CameraMedia | null {
  return media.find((item) => item.media_type === 'video' && item.status === 'recording') ?? null;
}

export function mapStrategyOptions(strategies?: Strategy[] | null): StrategyOption[] {
  return (strategies ?? []).map((item) => ({
    label: item.name,
    value: item.id,
  }));
}

export function buildMonitorConfigData(config?: SignalMonitorConfig | null) {
  if (!config) {
    return null;
  }

  const {
    enabled,
    runtime_mode,
    signal_strategy_id,
    monitor_interval_seconds,
    schedule_type,
    schedule_value,
    manual_until,
    last_run_at,
    next_run_at,
    last_error,
  } = config;

  return {
    enabled,
    runtime_mode,
    signal_strategy_id,
    monitor_interval_seconds,
    schedule_type,
    schedule_value,
    manual_until,
    last_run_at,
    next_run_at,
    last_error,
  };
}
