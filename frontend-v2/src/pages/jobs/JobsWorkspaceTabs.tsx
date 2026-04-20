import { Tabs } from 'antd';
import type { JobsWorkspaceTabsProps } from '@/pages/jobs/jobsWorkspaceTabs.types';
import type { JobsWorkspaceTabKey } from '@/pages/jobs/jobsWorkspaceTabs.types';
import { buildJobsWorkspaceTabsItems } from '@/pages/jobs/jobsWorkspaceTabs.helpers';

const WORKSPACE_TAB_KEYS: readonly JobsWorkspaceTabKey[] = ['queue', 'schedule'];

const isJobsWorkspaceTabKey = (value: string): value is JobsWorkspaceTabKey =>
  WORKSPACE_TAB_KEYS.some((key) => key === value);

export function JobsWorkspaceTabs(props: JobsWorkspaceTabsProps) {
  return (
    <Tabs
      className="workspace-tabs jobs-workspace-tabs"
      type="card"
      activeKey={props.shared.values.workspaceTab}
      onChange={(key) => {
        if (isJobsWorkspaceTabKey(key)) {
          props.shared.handlers.onWorkspaceTabChange(key);
        }
      }}
      items={buildJobsWorkspaceTabsItems(props)}
    />
  );
}
