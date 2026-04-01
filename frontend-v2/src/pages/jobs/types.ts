export type UploadFormValues = {
  taskMode: 'upload' | 'camera_once' | 'camera_schedule';
  uploadSource?: 'local_file' | 'camera_snapshot';
  uploadCameraId?: string;
  strategyId: string;
  cameraId?: string;
  precheckStrategyId?: string;
  precheckPersonThreshold?: number;
  precheckSoftNegativeThreshold?: number;
  precheckStateTtlSeconds?: number;
  scheduleType?: 'interval_minutes' | 'daily_time';
  intervalMinutes?: number;
  dailyTime?: string;
};

export type EditScheduleFormValues = {
  scheduleType: 'interval_minutes' | 'daily_time';
  precheckStrategyId?: string;
  precheckPersonThreshold?: number;
  precheckSoftNegativeThreshold?: number;
  precheckStateTtlSeconds?: number;
  intervalMinutes?: number;
  dailyTime?: string;
};

export const JOB_TASK_MODE_OPTIONS = [
  { label: '图片上传', value: 'upload' },
  { label: '摄像头单次抽帧', value: 'camera_once' },
  { label: '摄像头定时任务', value: 'camera_schedule' },
] as const;

export const JOB_UPLOAD_SOURCE_OPTIONS = [
  { label: '本地文件上传', value: 'local_file' },
  { label: '摄像头拍照上传', value: 'camera_snapshot' },
] as const;

export const DEFAULT_FORM_VALUES: UploadFormValues = {
  taskMode: 'upload',
  uploadSource: 'local_file',
  uploadCameraId: undefined,
  strategyId: '',
  cameraId: undefined,
  precheckStrategyId: undefined,
  precheckPersonThreshold: 0.5,
  precheckSoftNegativeThreshold: 0.2,
  precheckStateTtlSeconds: 120,
  scheduleType: 'interval_minutes',
  intervalMinutes: 15,
  dailyTime: '08:30',
};
