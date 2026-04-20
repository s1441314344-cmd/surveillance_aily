import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_JOBS_WORKSPACE_STATE_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobsWorkspaceState.ts',
);

describe('useJobsWorkspaceState boundaries', () => {
  it('groups workspace state into queueFilters, scheduleFilters, draftState, and selection', () => {
    const source = fs.readFileSync(USE_JOBS_WORKSPACE_STATE_FILE, 'utf8');
    const returnStart = source.indexOf('return {');
    const returnEnd = source.indexOf('\n  };', returnStart);
    const returnBlock =
      returnStart >= 0 && returnEnd >= 0
        ? source.slice(returnStart + 'return {'.length, returnEnd)
        : '';

    expect(returnBlock).toContain('queueFilters: {');
    expect(returnBlock).toContain('scheduleFilters: {');
    expect(returnBlock).toContain('draftState: {');
    expect(returnBlock).toContain('selection: {');

    expect(returnBlock).toContain('handleResetQueueFilters,');
    expect(returnBlock).toContain('handleResetScheduleFilters,');
    expect(returnBlock).toContain('setEditScheduleType,');
    expect(returnBlock).toContain('setWorkspaceTab,');

    expect(returnBlock).not.toContain('\n    statusFilter,');
    expect(returnBlock).not.toContain('\n    scheduleStatusFilter,');
    expect(returnBlock).not.toContain('\n    fileList,');
    expect(returnBlock).not.toContain('\n    selectedJobId,');
  });

  it('keeps queue and schedule filter defaults in dedicated buckets', () => {
    const source = fs.readFileSync(USE_JOBS_WORKSPACE_STATE_FILE, 'utf8');

    expect(source).toContain('const JOBS_QUEUE_FILTER_DEFAULTS = {');
    expect(source).toContain('const JOBS_SCHEDULE_FILTER_DEFAULTS = {');
    expect(source).toContain('useState<string>(JOBS_QUEUE_FILTER_DEFAULTS.statusFilter)');
    expect(source).toContain('useState<string>(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleStatusFilter)');
    expect(source).toContain('setStatusFilter(JOBS_QUEUE_FILTER_DEFAULTS.statusFilter);');
    expect(source).toContain('setScheduleStatusFilter(JOBS_SCHEDULE_FILTER_DEFAULTS.scheduleStatusFilter);');

    expect(source).not.toContain('const JOBS_WORKSPACE_FILTER_DEFAULTS = {');
  });
});
