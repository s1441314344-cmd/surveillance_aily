import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  cancelJob,
  createCameraOnceJob,
  createCameraSnapshotUploadJob,
  retryJob,
  uploadJob,
} from '@/shared/api/jobs';
import { DEFAULT_FORM_VALUES, type UploadFormValues } from '@/pages/jobs/types';
import { createJobsApiErrorHandler, invalidateJobsQueries } from '@/pages/jobs/jobsMutationHelpers';

const UPLOAD_QUEUED_MESSAGE = '上传任务已进入队列';
const CAMERA_ONCE_QUEUED_MESSAGE = '摄像头单次任务已进入队列';
const CAMERA_SNAPSHOT_QUEUED_MESSAGE = '摄像头拍照上传任务已进入队列';

type UseJobMutationsFormsParams = {
  form: FormInstance<UploadFormValues>;
};

type UseJobMutationsFeedbackParams = {
  message: MessageInstance;
};

type UseJobMutationsJobWorkflowParams = {
  setFileList: (value: UploadFile[]) => void;
  setSelectedJobId: (value: string | null) => void;
};

type UseJobMutationsParams = {
  forms: UseJobMutationsFormsParams;
  feedback: UseJobMutationsFeedbackParams;
  jobWorkflow: UseJobMutationsJobWorkflowParams;
};

export function useJobMutations({
  forms,
  feedback,
  jobWorkflow,
}: UseJobMutationsParams) {
  const { form } = forms;
  const { message } = feedback;
  const { setFileList, setSelectedJobId } = jobWorkflow;
  const queryClient = useQueryClient();
  const handleQueuedJobSuccess = async ({
    job,
    successMessage,
    clearFiles = false,
  }: {
    job: { id: string };
    successMessage: string;
    clearFiles?: boolean;
  }) => {
    await invalidateJobsQueries({ queryClient });
    setSelectedJobId(job.id);
    if (clearFiles) {
      setFileList([]);
    }
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    message.success(successMessage);
  };

  const uploadMutation = useMutation({
    mutationFn: uploadJob,
    onSuccess: async (job) => {
      await handleQueuedJobSuccess({ job, successMessage: UPLOAD_QUEUED_MESSAGE, clearFiles: true });
    },
    onError: createJobsApiErrorHandler({
      feedback: { message },
      fallback: '上传任务创建失败',
    }),
  });

  const cameraOnceMutation = useMutation({
    mutationFn: createCameraOnceJob,
    onSuccess: async (job) => {
      await handleQueuedJobSuccess({ job, successMessage: CAMERA_ONCE_QUEUED_MESSAGE });
    },
    onError: createJobsApiErrorHandler({
      feedback: { message },
      fallback: '摄像头单次任务创建失败',
    }),
  });

  const cameraSnapshotUploadMutation = useMutation({
    mutationFn: createCameraSnapshotUploadJob,
    onSuccess: async (job) => {
      await handleQueuedJobSuccess({ job, successMessage: CAMERA_SNAPSHOT_QUEUED_MESSAGE });
    },
    onError: createJobsApiErrorHandler({
      feedback: { message },
      fallback: '摄像头拍照上传失败',
    }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: async (job) => {
      await invalidateJobsQueries({ queryClient });
      setSelectedJobId(job.id);
      message.success('任务状态已更新');
    },
    onError: createJobsApiErrorHandler({
      feedback: { message },
      fallback: '取消任务失败',
    }),
  });

  const retryMutation = useMutation({
    mutationFn: retryJob,
    onSuccess: async (job) => {
      await invalidateJobsQueries({ queryClient });
      setSelectedJobId(job.id);
      message.success('已创建重试任务并进入队列');
    },
    onError: createJobsApiErrorHandler({
      feedback: { message },
      fallback: '重试任务创建失败',
    }),
  });

  return {
    uploadMutation,
    cameraOnceMutation,
    cameraSnapshotUploadMutation,
    cancelMutation,
    retryMutation,
  };
}
