import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_WORKSPACE_TABS_TYPES_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsWorkspaceTabs.types.ts',
);
const JOBS_WORKSPACE_TABS_HELPERS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsWorkspaceTabs.helpers.tsx',
);
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);

describe('JobsWorkspaceTabs boundaries', () => {
  it('keeps queue and schedule buckets aligned with section boundaries', () => {
    const source = fs.readFileSync(JOBS_WORKSPACE_TABS_TYPES_FILE, 'utf8');
    const helperSource = fs.readFileSync(JOBS_WORKSPACE_TABS_HELPERS_FILE, 'utf8');
    const builderSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');
    const topLevelPropsBlock =
      source.match(/export type JobsWorkspaceTabsProps = \{([\s\S]*?)\n\};/) ?? [];
    const topLevelProps = topLevelPropsBlock[1] ?? '';
    const queuePropsBlock =
      source.match(/export type JobsWorkspaceQueueProps = \{([\s\S]*?)\n\};/) ?? [];
    const queueProps = queuePropsBlock[1] ?? '';
    const schedulePropsBlock =
      source.match(/export type JobsWorkspaceScheduleProps = \{([\s\S]*?)\n\};/) ?? [];
    const scheduleProps = schedulePropsBlock[1] ?? '';

    expect(source).toContain('type JobsWorkspaceSharedProps = {');
    expect(source).toContain('type JobsWorkspaceQueueProps = {');
    expect(source).toContain('type JobsWorkspaceScheduleProps = {');

    expect(topLevelProps).toContain('shared: JobsWorkspaceSharedProps;');
    expect(topLevelProps).toContain('queue: JobsWorkspaceQueueProps;');
    expect(topLevelProps).toContain('schedule: JobsWorkspaceScheduleProps;');

    expect(topLevelProps).not.toContain('jobs: Job[];');
    expect(topLevelProps).not.toContain('schedules: JobSchedule[];');
    expect(topLevelProps).not.toContain('statusFilter: string;');
    expect(topLevelProps).not.toContain('scheduleStatusFilter: string;');

    expect(queueProps).toContain('filters: JobsWorkspaceQueueFiltersProps;');
    expect(queueProps).toContain('timeRange: JobsWorkspaceQueueTimeRangeProps;');
    expect(queueProps).toContain('table: JobsWorkspaceQueueTableProps;');
    expect(queueProps).not.toContain('jobs: Job[];');
    expect(queueProps).not.toContain('statusFilter: string;');
    expect(queueProps).not.toContain('onStatusChange: (value: string) => void;');

    expect(scheduleProps).toContain('filters: JobsWorkspaceScheduleFiltersProps;');
    expect(scheduleProps).toContain('table: JobsWorkspaceScheduleTableProps;');
    expect(scheduleProps).not.toContain('schedules: JobSchedule[];');
    expect(scheduleProps).not.toContain('scheduleStatusFilter: string;');
    expect(scheduleProps).not.toContain('onRunNow: (scheduleId: string) => void;');

    expect(helperSource).not.toContain('const buildQueueSectionProps = (');
    expect(helperSource).not.toContain('const buildScheduleSectionProps = (');
    expect(helperSource).toContain("<JobQueueSection {...props.queue} />");
    expect(helperSource).toContain("<JobScheduleSection {...props.schedule} />");
    expect(helperSource).toContain("import type { TabsProps } from 'antd';");
    expect(helperSource).toContain("type JobsWorkspaceTabItem = NonNullable<TabsProps['items']>[number];");
    expect(helperSource).toContain(
      'export function buildJobsWorkspaceTabsItems(props: JobsWorkspaceTabsProps): TabsProps[\'items\'] {',
    );

    expect(builderSource).toContain('queue: {');
    expect(builderSource).toContain('filters: {');
    expect(builderSource).toContain('timeRange: {');
    expect(builderSource).toContain('table: {');
    expect(builderSource).toContain('schedule: {');
  });
});
