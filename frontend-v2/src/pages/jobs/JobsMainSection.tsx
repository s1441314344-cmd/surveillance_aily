import { JobCreatePanel } from '@/pages/jobs/JobCreatePanel';
import { JobsWorkspaceTabs } from '@/pages/jobs/JobsWorkspaceTabs';
import {
  buildJobCreatePanelProps,
  buildJobsWorkspaceTabsProps,
} from '@/pages/jobs/jobsMainSectionProps';
import type { useJobsPageController } from '@/pages/jobs/useJobsPageController';

type JobsPageController = ReturnType<typeof useJobsPageController>;

type JobsMainSectionProps = {
  controller: JobsPageController;
};

export function JobsMainSection({ controller }: JobsMainSectionProps) {
  const jobCreatePanelProps = buildJobCreatePanelProps(controller);
  const jobsWorkspaceTabsProps = buildJobsWorkspaceTabsProps(controller);

  return (
    <div className="page-grid page-grid--sidebar">
      <JobCreatePanel {...jobCreatePanelProps} />

      <JobsWorkspaceTabs {...jobsWorkspaceTabsProps} />
    </div>
  );
}
