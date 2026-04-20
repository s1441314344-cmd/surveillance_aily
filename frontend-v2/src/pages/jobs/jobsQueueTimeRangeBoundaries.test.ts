import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_QUEUE_SECTION_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobQueueSection.tsx');
const JOBS_WORKSPACE_TABS_TYPES_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsWorkspaceTabs.types.ts',
);
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);

describe('jobs queue time range boundaries', () => {
  it('keeps JobQueueSection timeRange grouped by values and handlers', () => {
    const source = fs.readFileSync(JOB_QUEUE_SECTION_FILE, 'utf8');

    expect(source).toContain('type JobQueueTimeRangeValuesProps = {');
    expect(source).toContain('type JobQueueTimeRangeHandlersProps = {');
    expect(source).toContain('values: JobQueueTimeRangeValuesProps;');
    expect(source).toContain('handlers: JobQueueTimeRangeHandlersProps;');
    expect(source).toContain('handleDateTimeInputChange(event, timeRange.handlers.onCreatedFromChange)');
    expect(source).toContain('value={timeRange.values.createdFromFilter}');
    expect(source).toContain('onClick={timeRange.handlers.onClearDateRange}');
    expect(source).toContain('onClick={timeRange.handlers.onResetFilters}');
  });

  it('keeps workspace queue timeRange grouped before reaching JobQueueSection', () => {
    const typesSource = fs.readFileSync(JOBS_WORKSPACE_TABS_TYPES_FILE, 'utf8');
    const builderSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');

    expect(typesSource).toContain('export type JobsWorkspaceQueueTimeRangeProps = {');
    expect(typesSource).toContain('values: {');
    expect(typesSource).toContain('handlers: {');
    expect(builderSource).toContain('timeRange: {');
    expect(builderSource).toContain('values: {');
    expect(builderSource).toContain('handlers: {');
  });
});
