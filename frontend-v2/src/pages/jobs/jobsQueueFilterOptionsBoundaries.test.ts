import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_QUEUE_FILTERS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobQueueFilters.tsx');
const JOBS_WORKSPACE_TABS_TYPES_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsWorkspaceTabs.types.ts',
);
const JOBS_OPTION_ITEM_FILE = path.resolve(process.cwd(), 'src/pages/jobs/jobsOptionItem.ts');
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);

describe('jobs queue filter options boundaries', () => {
  it('keeps trigger mode options inside the queue options bucket', () => {
    const source = fs.readFileSync(JOB_QUEUE_FILTERS_FILE, 'utf8');
    const optionItemSource = fs.readFileSync(JOBS_OPTION_ITEM_FILE, 'utf8');

    expect(optionItemSource).toContain('export type OptionItem = {');
    expect(source).toContain("import type { OptionItem } from '@/pages/jobs/jobsOptionItem';");
    expect(source).toContain('type JobQueueFilterOptionsProps = {');
    expect(source).toContain('triggerModeOptions: readonly OptionItem[];');
    expect(source).toContain('options={[...options.triggerModeOptions]}');
    expect(source).not.toContain("import { FilterToolbar, TRIGGER_MODE_FILTER_OPTIONS } from '@/shared/ui';");
    expect(source).not.toContain('TRIGGER_MODE_FILTER_OPTIONS.map(');
  });

  it('keeps workspace queue filters providing trigger mode options before JobQueueFilters', () => {
    const typesSource = fs.readFileSync(JOBS_WORKSPACE_TABS_TYPES_FILE, 'utf8');
    const builderSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');

    expect(typesSource).toContain("import type { OptionItem } from '@/pages/jobs/jobsOptionItem';");
    expect(typesSource).not.toContain('export type OptionItem = {');
    expect(typesSource).toContain('export type JobsWorkspaceQueueFiltersProps = {');
    expect(typesSource).toContain('triggerModeOptions: OptionItem[];');
    expect(builderSource).toContain('options: {');
    expect(builderSource).toContain('triggerModeOptions: [...TRIGGER_MODE_FILTER_OPTIONS],');
    expect(builderSource).not.toContain('const JOB_TRIGGER_MODE_FILTER_OPTIONS =');
    expect(builderSource).not.toContain('TRIGGER_MODE_FILTER_OPTIONS.map((item) => ({');
  });
});
