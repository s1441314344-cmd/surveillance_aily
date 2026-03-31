import { App, type FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { JobSchedule } from '@/shared/api/tasks';
import { type EditScheduleFormValues, type UploadFormValues } from '@/pages/jobs/types';
import { useJobMutations } from '@/pages/jobs/useJobMutations';
import { useScheduleMutations } from '@/pages/jobs/useScheduleMutations';

type UseJobsMutationStateParams = {
  form: FormInstance<UploadFormValues>;
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
  setFileList: (value: UploadFile[]) => void;
  setSelectedJobId: (value: string | null) => void;
  setTriggerModeFilter: (value: string) => void;
  setScheduleFilter: (value: string) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
};

export function useJobsMutationState({
  form,
  scheduleEditForm,
  setFileList,
  setSelectedJobId,
  setTriggerModeFilter,
  setScheduleFilter,
  setEditingSchedule,
}: UseJobsMutationStateParams) {
  const { message } = App.useApp();

  const jobMutations = useJobMutations({
    form,
    message,
    setFileList,
    setSelectedJobId,
  });

  const scheduleMutations = useScheduleMutations({
    form,
    scheduleEditForm,
    message,
    setTriggerModeFilter,
    setScheduleFilter,
    setEditingSchedule,
  });

  return {
    ...jobMutations,
    ...scheduleMutations,
  };
}
