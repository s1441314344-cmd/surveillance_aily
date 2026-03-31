import type { Camera } from '@/shared/api/configCenter';
import type { MessageInstance } from 'antd/es/message/interface';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import type { UploadFormValues } from '@/pages/jobs/types';

export type JobsFormMessage = MessageInstance;

export const getScheduleValue = (
  scheduleType: UploadFormValues['scheduleType'],
  dailyTime: UploadFormValues['dailyTime'],
  intervalMinutes: UploadFormValues['intervalMinutes'],
) => {
  if (scheduleType === 'daily_time') {
    return dailyTime?.trim() ?? '';
  }

  return String(intervalMinutes ?? '').trim();
};

export const isRtspCamera = (camera: Camera | null | undefined) =>
  (camera?.protocol ?? '').toLowerCase() === 'rtsp';

export const requireSelectedCamera = (
  cameraId: string | undefined,
  message: JobsFormMessage,
  warningText: string,
): cameraId is string => {
  if (!cameraId) {
    message.warning(warningText);
    return false;
  }

  return true;
};

export const requireRtspCamera = (
  camera: Camera | null,
  message: JobsFormMessage,
  warningText: string,
) => {
  if (!isRtspCamera(camera)) {
    message.warning(warningText);
    return false;
  }

  return true;
};

export const collectRcFiles = (fileList: UploadFile[]): RcFile[] =>
  fileList
    .map((file) => file.originFileObj)
    .filter((file): file is RcFile => Boolean(file));
