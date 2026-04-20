import type { Camera } from '@/shared/api/cameras';
import type { MessageInstance } from 'antd/es/message/interface';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import type { UploadFormValues } from '@/pages/jobs/types';

export type JobsFormMessage = MessageInstance;

type JobsFormUtilsScheduleParams = {
  scheduleType: UploadFormValues['scheduleType'];
  dailyTime: UploadFormValues['dailyTime'];
  intervalMinutes: UploadFormValues['intervalMinutes'];
};

type JobsFormUtilsFeedbackParams = {
  message: JobsFormMessage;
  warningText: string;
};

type JobsFormUtilsCameraSelectionParams = {
  cameraId: string | undefined;
  feedback: JobsFormUtilsFeedbackParams;
};

type JobsFormUtilsCameraProtocolParams = {
  camera: Camera | null;
  feedback: JobsFormUtilsFeedbackParams;
};

export const getScheduleValue = ({
  scheduleType,
  dailyTime,
  intervalMinutes,
}: JobsFormUtilsScheduleParams) => {
  if (scheduleType === 'daily_time') {
    return dailyTime?.trim() ?? '';
  }

  return String(intervalMinutes ?? '').trim();
};

export const isRtspCamera = (camera: Camera | null | undefined) =>
  (camera?.protocol ?? '').toLowerCase() === 'rtsp';

export const requireSelectedCamera = ({
  cameraId,
  feedback,
}: JobsFormUtilsCameraSelectionParams) => {
  const { message, warningText } = feedback;
  if (!cameraId) {
    message.warning(warningText);
    return false;
  }

  return true;
};

export const requireRtspCamera = ({
  camera,
  feedback,
}: JobsFormUtilsCameraProtocolParams) => {
  const { message, warningText } = feedback;
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
