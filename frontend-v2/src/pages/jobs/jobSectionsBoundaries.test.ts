import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_QUEUE_SECTION_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobQueueSection.tsx');
const JOB_SCHEDULE_SECTION_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobScheduleSection.tsx');

describe('jobs section boundaries', () => {
  it('keeps JobQueueSection grouped by filters, timeRange, and table props', () => {
    const source = fs.readFileSync(JOB_QUEUE_SECTION_FILE, 'utf8');

    expect(source).toContain('type JobQueueTimeRangeProps = {');
    expect(source).toContain('filters: Parameters<typeof JobQueueFilters>[0];');
    expect(source).toContain('timeRange: JobQueueTimeRangeProps;');
    expect(source).toContain('table: Parameters<typeof JobQueueTable>[0];');
    expect(source).toContain('export function JobQueueSection({ filters, timeRange, table }: JobQueueSectionProps) {');
  });

  it('keeps JobScheduleSection grouped by filters and table props', () => {
    const source = fs.readFileSync(JOB_SCHEDULE_SECTION_FILE, 'utf8');

    expect(source).toContain('type JobScheduleSectionFiltersProps = {');
    expect(source).toContain('filters: JobScheduleSectionFiltersProps;');
    expect(source).toContain('table: Parameters<typeof ScheduleTable>[0];');
    expect(source).toContain('export function JobScheduleSection({ filters, table }: JobScheduleSectionProps) {');
  });
});
