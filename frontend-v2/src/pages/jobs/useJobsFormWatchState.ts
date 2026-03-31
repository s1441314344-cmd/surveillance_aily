import { Form, type FormInstance } from 'antd';
import type { UploadFormValues } from '@/pages/jobs/types';

type UseJobsFormWatchStateParams = {
  form: FormInstance<UploadFormValues>;
};

export function useJobsFormWatchState({ form }: UseJobsFormWatchStateParams) {
  const taskMode = Form.useWatch('taskMode', form) ?? 'upload';
  const uploadSource = Form.useWatch('uploadSource', form) ?? 'local_file';
  const scheduleType = Form.useWatch('scheduleType', form) ?? 'interval_minutes';
  const selectedCameraIdInForm = Form.useWatch('cameraId', form) ?? undefined;
  const selectedUploadCameraIdInForm = Form.useWatch('uploadCameraId', form) ?? undefined;

  return {
    taskMode,
    uploadSource,
    scheduleType,
    selectedCameraIdInForm,
    selectedUploadCameraIdInForm,
  };
}
