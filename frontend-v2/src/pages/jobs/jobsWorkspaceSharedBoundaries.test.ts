import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_WORKSPACE_TABS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobsWorkspaceTabs.tsx',
);
const JOBS_WORKSPACE_TABS_TYPES_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsWorkspaceTabs.types.ts',
);
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);

describe('jobs workspace shared boundaries', () => {
  it('keeps JobsWorkspaceTabs shared props grouped by values and handlers', () => {
    const tabsSource = fs.readFileSync(JOBS_WORKSPACE_TABS_FILE, 'utf8');
    const typesSource = fs.readFileSync(JOBS_WORKSPACE_TABS_TYPES_FILE, 'utf8');

    expect(typesSource).toContain('export type JobsWorkspaceSharedProps = {');
    expect(typesSource).toContain('values: {');
    expect(typesSource).toContain('workspaceTab: JobsWorkspaceTabKey;');
    expect(typesSource).toContain('handlers: {');
    expect(typesSource).toContain('onWorkspaceTabChange: (value: JobsWorkspaceTabKey) => void;');

    expect(tabsSource).toContain('activeKey={props.shared.values.workspaceTab}');
    expect(tabsSource).toContain("const WORKSPACE_TAB_KEYS: readonly JobsWorkspaceTabKey[] = ['queue', 'schedule'];");
    expect(tabsSource).toContain('const isJobsWorkspaceTabKey = (value: string): value is JobsWorkspaceTabKey =>');
    expect(tabsSource).toContain('WORKSPACE_TAB_KEYS.some((key) => key === value);');
    expect(tabsSource).toContain('if (isJobsWorkspaceTabKey(key)) {');
    expect(tabsSource).toContain('props.shared.handlers.onWorkspaceTabChange(key);');
    expect(tabsSource).not.toContain('value as JobsWorkspaceTabKey');
    expect(tabsSource).not.toContain('key as JobsWorkspaceTabKey');
  });

  it('keeps main section builder grouping shared values and handlers before tabs', () => {
    const builderSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');

    expect(builderSource).toContain('shared: {');
    expect(builderSource).toContain('values: {');
    expect(builderSource).toContain('workspaceTab: controller.workspace.selection.workspaceTab,');
    expect(builderSource).toContain('handlers: {');
    expect(builderSource).toContain('onWorkspaceTabChange: controller.workspace.selection.setWorkspaceTab,');
  });
});
