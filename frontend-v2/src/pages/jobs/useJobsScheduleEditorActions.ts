import { App, type FormInstance } from 'antd';
import type { JobSchedule } from '@/shared/api/jobs';
import type { EditScheduleFormValues } from '@/pages/jobs/types';
import type { useJobsMutationState } from '@/pages/jobs/useJobsMutationState';

type UseJobsScheduleEditorActionsFormParams = {
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
};

type UseJobsScheduleEditorActionsDraftStateParams = {
  editingSchedule: JobSchedule | null;
  setEditScheduleType: (value: EditScheduleFormValues['scheduleType']) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
};

type UseJobsScheduleEditorActionsMutationsParams = {
  updateScheduleMutation: ReturnType<typeof useJobsMutationState>['updateScheduleMutation'];
};

type UseJobsScheduleEditorActionsParams = {
  form: UseJobsScheduleEditorActionsFormParams;
  draftState: UseJobsScheduleEditorActionsDraftStateParams;
  mutations: UseJobsScheduleEditorActionsMutationsParams;
};

export function useJobsScheduleEditorActions({
  form,
  draftState,
  mutations,
}: UseJobsScheduleEditorActionsParams) {
  const { message } = App.useApp();

  const handleOpenScheduleEditor = (schedule: JobSchedule) => {
    draftState.setEditScheduleType(schedule.schedule_type as EditScheduleFormValues['scheduleType']);
    draftState.setEditingSchedule(schedule);
    form.scheduleEditForm.setFieldsValue({
      precheckStrategyId: schedule.precheck_strategy_id ?? undefined,
      precheckPersonThreshold: schedule.precheck_config?.person_threshold ?? 0.5,
      precheckSoftNegativeThreshold: schedule.precheck_config?.soft_negative_threshold ?? 0.2,
      precheckStateTtlSeconds: schedule.precheck_config?.state_ttl_seconds ?? 120,
      scheduleType: schedule.schedule_type as EditScheduleFormValues['scheduleType'],
      intervalMinutes:
        schedule.schedule_type === 'interval_minutes' ? Number(schedule.schedule_value || 1) : undefined,
      dailyTime: schedule.schedule_type === 'daily_time' ? schedule.schedule_value : undefined,
    });
  };

  const handleCloseScheduleEditor = () => {
    draftState.setEditingSchedule(null);
    draftState.setEditScheduleType('interval_minutes');
    form.scheduleEditForm.resetFields();
  };

  const handleSubmitScheduleEdit = async (values: EditScheduleFormValues) => {
    if (!draftState.editingSchedule) {
      return;
    }

    const scheduleValue =
      values.scheduleType === 'daily_time'
        ? values.dailyTime?.trim()
        : String(values.intervalMinutes ?? '').trim();
    if (!scheduleValue) {
      message.warning('请补充完整的计划配置');
      return;
    }

    await mutations.updateScheduleMutation.mutateAsync({
      scheduleId: draftState.editingSchedule.id,
      payload: {
        precheckStrategyId: values.precheckStrategyId || undefined,
        precheckConfig:
          values.precheckStrategyId
            ? {
                personThreshold: values.precheckPersonThreshold,
                softNegativeThreshold: values.precheckSoftNegativeThreshold,
                stateTtlSeconds: values.precheckStateTtlSeconds,
              }
            : {},
        scheduleType: values.scheduleType,
        scheduleValue,
      },
    });
  };

  return {
    handleOpenScheduleEditor,
    handleCloseScheduleEditor,
    handleSubmitScheduleEdit,
  };
}
