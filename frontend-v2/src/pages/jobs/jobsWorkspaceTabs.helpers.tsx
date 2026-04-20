import type { ReactNode } from 'react';
import type { TabsProps } from 'antd';
import { JobQueueSection } from '@/pages/jobs/JobQueueSection';
import { JobScheduleSection } from '@/pages/jobs/JobScheduleSection';
import type { JobsWorkspaceTabsProps } from './jobsWorkspaceTabs.types';

const QUEUE_TAB_LABEL = '任务队列';
const SCHEDULE_TAB_LABEL = '定时计划';

type JobsWorkspaceTabItem = NonNullable<TabsProps['items']>[number];

const buildWorkspaceTabItem = (
  key: 'queue' | 'schedule',
  label: string,
  children: ReactNode,
): JobsWorkspaceTabItem => ({
  key,
  label,
  children,
});

export function buildJobsWorkspaceTabsItems(props: JobsWorkspaceTabsProps): TabsProps['items'] {
  return [
    buildWorkspaceTabItem('queue', QUEUE_TAB_LABEL, <JobQueueSection {...props.queue} />),
    buildWorkspaceTabItem('schedule', SCHEDULE_TAB_LABEL, <JobScheduleSection {...props.schedule} />),
  ];
}
