import { JobDetailDrawer } from '@/pages/jobs/JobDetailDrawer';
import { ScheduleEditModal } from '@/pages/jobs/ScheduleEditModal';
import { buildJobDetailDrawerProps, buildScheduleEditModalProps } from '@/pages/jobs/jobsOverlaySectionProps';
import type { useJobsPageController } from '@/pages/jobs/useJobsPageController';

type JobsPageController = ReturnType<typeof useJobsPageController>;

type JobsOverlaySectionProps = {
  controller: JobsPageController;
};

export function JobsOverlaySection({ controller }: JobsOverlaySectionProps) {
  const jobDetailDrawerProps = buildJobDetailDrawerProps(controller);
  const scheduleEditModalProps = buildScheduleEditModalProps(controller);

  return (
    <>
      <JobDetailDrawer {...jobDetailDrawerProps} />

      <ScheduleEditModal {...scheduleEditModalProps} />
    </>
  );
}
