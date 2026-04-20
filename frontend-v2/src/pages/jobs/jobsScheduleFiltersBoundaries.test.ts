import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_SCHEDULE_SECTION_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobScheduleSection.tsx');
const JOBS_WORKSPACE_TABS_TYPES_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsWorkspaceTabs.types.ts',
);
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);
const JOBS_QUERY_UTILS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/jobsQueryUtils.ts');

describe('jobs schedule filters boundaries', () => {
  it('keeps JobScheduleSection filters grouped by values, options, and handlers', () => {
    const source = fs.readFileSync(JOB_SCHEDULE_SECTION_FILE, 'utf8');

    expect(source).toContain("import type { OptionItem } from '@/pages/jobs/jobsOptionItem';");
    expect(source).toContain('type JobScheduleSectionFilterValuesProps = {');
    expect(source).toContain('type JobScheduleSectionFilterOptionsProps = {');
    expect(source).toContain('statusOptions: readonly OptionItem[];');
    expect(source).not.toContain('ReadonlyArray<{ label: string; value: string }>');
    expect(source).toContain('type JobScheduleSectionFilterHandlersProps = {');
    expect(source).toContain('values: JobScheduleSectionFilterValuesProps;');
    expect(source).toContain('options: JobScheduleSectionFilterOptionsProps;');
    expect(source).toContain('handlers: JobScheduleSectionFilterHandlersProps;');
    expect(source).toContain('value={filters.values.scheduleStatusFilter}');
    expect(source).toContain('onChange={filters.handlers.onScheduleStatusFilterChange}');
    expect(source).toContain('options={[...filters.options.statusOptions]}');
    expect(source).toContain('options={[...filters.options.cameraOptions]}');
    expect(source).not.toContain('const SCHEDULE_STATUS_FILTER_OPTIONS = [');
  });

  it('keeps workspace schedule filters grouped before reaching JobScheduleSection', () => {
    const typesSource = fs.readFileSync(JOBS_WORKSPACE_TABS_TYPES_FILE, 'utf8');
    const builderSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');
    const queryUtilsSource = fs.readFileSync(JOBS_QUERY_UTILS_FILE, 'utf8');

    expect(typesSource).toContain('export type JobsWorkspaceScheduleFiltersProps = {');
    expect(typesSource).toContain('values: {');
    expect(typesSource).toContain('options: {');
    expect(typesSource).toContain('handlers: {');
    expect(typesSource).toContain('statusOptions: OptionItem[];');
    expect(queryUtilsSource).toContain("import type { OptionItem } from '@/pages/jobs/jobsOptionItem';");
    expect(queryUtilsSource).not.toContain('type Option = { label: string; value: string };');
    expect(queryUtilsSource).toContain('export function getScheduleStatusFilterOptions(): OptionItem[] {');
    expect(builderSource).toContain('schedule: {');
    expect(builderSource).toContain('filters: {');
    expect(builderSource).toContain('values: {');
    expect(builderSource).toContain('options: {');
    expect(builderSource).toContain('statusOptions: getScheduleStatusFilterOptions()');
    expect(builderSource).not.toContain('const SCHEDULE_STATUS_FILTER_OPTIONS =');
    expect(builderSource).toContain('handlers: {');
  });
});
