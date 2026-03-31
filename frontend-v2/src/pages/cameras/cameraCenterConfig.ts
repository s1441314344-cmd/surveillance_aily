export const CREATE_CAMERA_ID = '__create__';

export type CameraFormValues = {
  name: string;
  location?: string;
  ip_address?: string;
  port?: number;
  protocol: string;
  username?: string;
  password?: string;
  rtsp_url?: string;
  frame_frequency_seconds: number;
  resolution: string;
  jpeg_quality: number;
  storage_path: string;
};

export type TriggerRuleFormValues = {
  name: string;
  event_type: 'person' | 'fire' | 'leak' | 'custom';
  event_key?: string;
  enabled: boolean;
  min_confidence: number;
  min_consecutive_frames: number;
  cooldown_seconds: number;
  description?: string;
};

export type MonitorConfigFormValues = {
  runtime_mode: 'daemon' | 'manual' | 'schedule';
  enabled: boolean;
  signal_strategy_id?: string;
  monitor_interval_seconds: number;
  schedule_type?: 'interval_minutes' | 'daily_time';
  schedule_value?: string;
  manual_until?: string;
};

export const DEFAULT_CAMERA_VALUES: CameraFormValues = {
  name: '',
  location: '',
  ip_address: '',
  port: 554,
  protocol: 'rtsp',
  username: '',
  password: '',
  rtsp_url: '',
  frame_frequency_seconds: 60,
  resolution: '1080p',
  jpeg_quality: 80,
  storage_path: './data/storage/cameras',
};

export const DEFAULT_TRIGGER_RULE_VALUES: TriggerRuleFormValues = {
  name: '',
  event_type: 'person',
  event_key: 'person',
  enabled: true,
  min_confidence: 0.6,
  min_consecutive_frames: 1,
  cooldown_seconds: 30,
  description: '',
};

export const DEFAULT_MONITOR_CONFIG_VALUES: MonitorConfigFormValues = {
  runtime_mode: 'daemon',
  enabled: true,
  signal_strategy_id: undefined,
  monitor_interval_seconds: 30,
  schedule_type: 'interval_minutes',
  schedule_value: '1',
  manual_until: '',
};

export const STATUS_COLOR_MAP: Record<string, string> = {
  online: 'green',
  warning: 'gold',
  offline: 'red',
  unknown: 'default',
  normal: 'blue',
};

export const CAMERA_CONNECTION_LABELS: Record<string, string> = {
  online: '在线',
  warning: '告警',
  offline: '离线',
  unknown: '未知',
};

export const CAMERA_ALERT_STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  warning: '告警',
  offline: '离线',
  unknown: '未知',
};

export const CAMERA_MEDIA_TYPE_LABELS: Record<string, string> = {
  photo: '照片',
  video: '视频',
};

export const CAMERA_MEDIA_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  recording: '录制中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const CAMERA_PROTOCOL_OPTIONS = [
  { label: 'RTSP', value: 'rtsp' },
  { label: 'ONVIF', value: 'onvif' },
] as const;

export const CAMERA_RESOLUTION_OPTIONS = [
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
  { label: '4K', value: '4k' },
] as const;

export const TRIGGER_EVENT_TYPE_LABELS: Record<string, string> = {
  person: '人员出现',
  fire: '疑似着火',
  leak: '疑似漏水',
  custom: '自定义事件',
};

export const TRIGGER_EVENT_TYPE_OPTIONS = [
  { label: `${TRIGGER_EVENT_TYPE_LABELS.person} (person)`, value: 'person' },
  { label: `${TRIGGER_EVENT_TYPE_LABELS.fire} (fire)`, value: 'fire' },
  { label: `${TRIGGER_EVENT_TYPE_LABELS.leak} (leak)`, value: 'leak' },
  { label: `${TRIGGER_EVENT_TYPE_LABELS.custom} (custom)`, value: 'custom' },
] as const;

export const RUNTIME_MODE_LABELS: Record<MonitorConfigFormValues['runtime_mode'], string> = {
  daemon: '自动轮询',
  manual: '手动时段',
  schedule: '按计划',
};

export const RUNTIME_MODE_OPTIONS = [
  { label: '自动轮询 (daemon)', value: 'daemon' },
  { label: '手动时段 (manual)', value: 'manual' },
  { label: '按计划 (schedule)', value: 'schedule' },
];

export const SCHEDULE_TYPE_OPTIONS = [
  { label: '按分钟间隔 (interval_minutes)', value: 'interval_minutes' },
  { label: '每日固定时间 (daily_time)', value: 'daily_time' },
];
