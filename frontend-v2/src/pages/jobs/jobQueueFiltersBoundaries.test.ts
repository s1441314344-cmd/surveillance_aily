import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_QUEUE_FILTERS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobQueueFilters.tsx');

describe('JobQueueFilters boundaries', () => {
  it('groups filter props by values, options, and handlers', () => {
    const source = fs.readFileSync(JOB_QUEUE_FILTERS_FILE, 'utf8');

    expect(source).toContain('type JobQueueFilterValuesProps = {');
    expect(source).toContain('type JobQueueFilterOptionsProps = {');
    expect(source).toContain('type JobQueueFilterHandlersProps = {');
    expect(source).toContain('values: JobQueueFilterValuesProps;');
    expect(source).toContain('options: JobQueueFilterOptionsProps;');
    expect(source).toContain('handlers: JobQueueFilterHandlersProps;');
    expect(source).toContain('export function JobQueueFilters({ values, options, handlers }: JobQueueFiltersProps) {');
  });
});
