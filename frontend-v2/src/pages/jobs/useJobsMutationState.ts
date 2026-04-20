import { App, type FormInstance } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { JobSchedule } from '@/shared/api/jobs';
import { type EditScheduleFormValues, type UploadFormValues } from '@/pages/jobs/types';
import { useJobMutations } from '@/pages/jobs/useJobMutations';
import { useScheduleMutations } from '@/pages/jobs/useScheduleMutations';

type UseJobsMutationStateFormsParams = {
  form: FormInstance<UploadFormValues>;
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
};

type UseJobsMutationStateJobWorkflowParams = {
  setFileList: (value: UploadFile[]) => void;
  setSelectedJobId: (value: string | null) => void;
};

type UseJobsMutationStateScheduleWorkflowParams = {
  setTriggerModeFilter: (value: string) => void;
  setScheduleFilter: (value: string) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
};

type UseJobsMutationStateParams = {
  forms: UseJobsMutationStateFormsParams;
  jobWorkflow: UseJobsMutationStateJobWorkflowParams;
  scheduleWorkflow: UseJobsMutationStateScheduleWorkflowParams;
};

export function useJobsMutationState({
  forms,
  jobWorkflow,
  scheduleWorkflow,
}: UseJobsMutationStateParams) {
  const { message } = App.useApp();

  const jobMutations = useJobMutations({
    forms: {
      form: forms.form,
    },
    feedback: {
      message,
    },
    jobWorkflow: {
      setFileList: jobWorkflow.setFileList,
      setSelectedJobId: jobWorkflow.setSelectedJobId,
    },
  });

  const scheduleMutations = useScheduleMutations({
    forms: {
      form: forms.form,
      scheduleEditForm: forms.scheduleEditForm,
    },
    feedback: {
      message,
    },
    scheduleWorkflow: {
      setTriggerModeFilter: scheduleWorkflow.setTriggerModeFilter,
      setScheduleFilter: scheduleWorkflow.setScheduleFilter,
      setEditingSchedule: scheduleWorkflow.setEditingSchedule,
    },
  });

  return {
    ...jobMutations,
    ...scheduleMutations,
  };
}
