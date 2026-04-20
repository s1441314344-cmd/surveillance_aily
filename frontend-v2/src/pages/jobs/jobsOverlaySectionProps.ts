import type { JobDetailDrawer } from '@/pages/jobs/JobDetailDrawer';
import type { ScheduleEditModal } from '@/pages/jobs/ScheduleEditModal';
import type { useJobsPageController } from '@/pages/jobs/useJobsPageController';
import { SCHEDULE_TYPE_OPTIONS } from '@/shared/ui';

type JobsPageController = ReturnType<typeof useJobsPageController>;

type JobDetailDrawerProps = Parameters<typeof JobDetailDrawer>[0];
type ScheduleEditModalProps = Parameters<typeof ScheduleEditModal>[0];

export function buildJobDetailDrawerProps(controller: JobsPageController): JobDetailDrawerProps {
  return {
    modal: {
      open: Boolean(controller.workspace.selection.selectedJobId),
    },
    data: {
      job: controller.jobDetail,
    },
    handlers: {
      onClose: controller.handlers.onCloseJobDrawer,
    },
  };
}

export function buildScheduleEditModalProps(controller: JobsPageController): ScheduleEditModalProps {
  return {
    modal: {
      open: Boolean(controller.workspace.selection.editingSchedule),
      confirmLoading: controller.mutations.updateScheduleMutation.isPending,
    },
    form: {
      form: controller.scheduleEditForm,
    },
    workflow: {
      scheduleType: controller.workspace.draftState.editScheduleType,
    },
    resources: {
      strategyLoading: controller.queries.strategyQuery.isLoading,
    },
    handlers: {
      onCancel: controller.actions.handleCloseScheduleEditor,
      onSubmit: controller.actions.handleSubmitScheduleEdit,
      onScheduleTypeChange: controller.workspace.draftState.setEditScheduleType,
    },
    options: {
      scheduleTypeOptions: SCHEDULE_TYPE_OPTIONS,
      precheckStrategyOptions: controller.queries.strategySelectOptions,
    },
  };
}
