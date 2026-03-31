import { Tabs } from 'antd';
import type { JobsWorkspaceTabsProps } from '@/pages/jobs/jobsWorkspaceTabs.types';
import { buildJobsWorkspaceTabsItems } from '@/pages/jobs/jobsWorkspaceTabs.helpers';

export function JobsWorkspaceTabs(props: JobsWorkspaceTabsProps) {
  return (
    <Tabs
      className="workspace-tabs jobs-workspace-tabs"
      type="card"
      activeKey={props.workspaceTab}
      onChange={(key) => props.onWorkspaceTabChange(key as JobsWorkspaceTabsProps['workspaceTab'])}
      items={buildJobsWorkspaceTabsItems(props)}
    />
  );
}
