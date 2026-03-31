import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import {
  createJobSchedule,
  deleteJobSchedule,
  runJobScheduleNow,
  updateJobSchedule,
  updateJobScheduleStatus,
  JobSchedule,
} from '@/shared/api/tasks';
import {
  DEFAULT_FORM_VALUES,
  type EditScheduleFormValues,
  type UploadFormValues,
} from '@/pages/jobs/types';
import {
  createJobsApiErrorHandler,
  invalidateJobsQueries,
  invalidateScheduleQueries,
} from '@/pages/jobs/jobsMutationHelpers';

type UseScheduleMutationsParams = {
  form: FormInstance<UploadFormValues>;
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
  message: MessageInstance;
  setTriggerModeFilter: (value: string) => void;
  setScheduleFilter: (value: string) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
};

function getScheduleCreateSuccessFormValues(form: FormInstance<UploadFormValues>) {
  return {
    taskMode: 'camera_schedule' as const,
    uploadSource: 'local_file' as const,
    uploadCameraId: undefined,
    strategyId: form.getFieldValue('strategyId'),
    cameraId: form.getFieldValue('cameraId'),
    precheckStrategyId: undefined,
    scheduleType: DEFAULT_FORM_VALUES.scheduleType,
    intervalMinutes: DEFAULT_FORM_VALUES.intervalMinutes,
    dailyTime: DEFAULT_FORM_VALUES.dailyTime,
  };
}

export function useScheduleMutations({
  form,
  scheduleEditForm,
  message,
  setTriggerModeFilter,
  setScheduleFilter,
  setEditingSchedule,
}: UseScheduleMutationsParams) {
  const queryClient = useQueryClient();
  const handleScheduleMutationSuccess = async (successMessage: string) => {
    await invalidateScheduleQueries(queryClient);
    message.success(successMessage);
  };

  const scheduleMutation = useMutation({
    mutationFn: createJobSchedule,
    onSuccess: async () => {
      await invalidateScheduleQueries(queryClient);
      form.setFieldsValue(getScheduleCreateSuccessFormValues(form));
      message.success('定时任务计划已创建');
    },
    onError: createJobsApiErrorHandler(message, '定时任务计划创建失败'),
  });

  const scheduleStatusMutation = useMutation({
    mutationFn: ({ scheduleId, status }: { scheduleId: string; status: string }) =>
      updateJobScheduleStatus(scheduleId, status),
    onSuccess: async () => handleScheduleMutationSuccess('计划状态已更新'),
    onError: createJobsApiErrorHandler(message, '计划状态更新失败'),
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({
      scheduleId,
      payload,
    }: {
      scheduleId: string;
      payload: { scheduleType: string; scheduleValue: string; precheckStrategyId?: string };
    }) => updateJobSchedule(scheduleId, payload),
    onSuccess: async () => {
      await handleScheduleMutationSuccess('计划配置已更新');
      setEditingSchedule(null);
      scheduleEditForm.resetFields();
    },
    onError: createJobsApiErrorHandler(message, '计划配置更新失败'),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: deleteJobSchedule,
    onSuccess: async () => handleScheduleMutationSuccess('计划已删除'),
    onError: createJobsApiErrorHandler(message, '删除计划失败'),
  });

  const runScheduleNowMutation = useMutation({
    mutationFn: runJobScheduleNow,
    onSuccess: async (job) => {
      await Promise.all([
        invalidateJobsQueries(queryClient),
        invalidateScheduleQueries(queryClient),
      ]);
      setTriggerModeFilter('schedule');
      setScheduleFilter(job.schedule_id ?? 'all');
      message.success('已按计划立即触发一次任务');
    },
    onError: createJobsApiErrorHandler(message, '计划立即执行失败'),
  });

  return {
    scheduleMutation,
    scheduleStatusMutation,
    updateScheduleMutation,
    deleteScheduleMutation,
    runScheduleNowMutation,
  };
}
