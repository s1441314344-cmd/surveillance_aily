import { App, type FormInstance } from 'antd';
import type { JobSchedule } from '@/shared/api/tasks';
import type { EditScheduleFormValues } from '@/pages/jobs/types';
import type { useJobsMutationState } from '@/pages/jobs/useJobsMutationState';

type UseJobsScheduleEditorActionsParams = {
  scheduleEditForm: FormInstance<EditScheduleFormValues>;
  editingSchedule: JobSchedule | null;
  setEditScheduleType: (value: EditScheduleFormValues['scheduleType']) => void;
  setEditingSchedule: (value: JobSchedule | null) => void;
  updateScheduleMutation: ReturnType<typeof useJobsMutationState>['updateScheduleMutation'];
};

export function useJobsScheduleEditorActions({
  scheduleEditForm,
  editingSchedule,
  setEditScheduleType,
  setEditingSchedule,
  updateScheduleMutation,
}: UseJobsScheduleEditorActionsParams) {
  const { message } = App.useApp();

  const handleOpenScheduleEditor = (schedule: JobSchedule) => {
    setEditScheduleType(schedule.schedule_type as EditScheduleFormValues['scheduleType']);
    setEditingSchedule(schedule);
    scheduleEditForm.setFieldsValue({
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
    setEditingSchedule(null);
    setEditScheduleType('interval_minutes');
    scheduleEditForm.resetFields();
  };

  const handleSubmitScheduleEdit = async (values: EditScheduleFormValues) => {
    if (!editingSchedule) {
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

    await updateScheduleMutation.mutateAsync({
      scheduleId: editingSchedule.id,
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
