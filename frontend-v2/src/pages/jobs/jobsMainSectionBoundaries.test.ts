import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_MAIN_SECTION_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobsMainSection.tsx');
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);

describe('JobsMainSection boundaries', () => {
  it('keeps controller fan-out behind dedicated props builders', () => {
    const source = fs.readFileSync(JOBS_MAIN_SECTION_FILE, 'utf8');

    expect(source).toContain('buildJobCreatePanelProps');
    expect(source).toContain('buildJobsWorkspaceTabsProps');

    expect(source).not.toContain('controller.queries.strategies');
    expect(source).not.toContain('controller.workspace.statusFilter');
    expect(source).not.toContain('controller.handlers.onStatusChange');
    expect(source).not.toContain('controller.mutations.cancelMutation.isPending');
  });

  it('reuses canonical schedule/upload option constants instead of local mapped copies', () => {
    const source = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');

    expect(source).toContain('scheduleTypeOptions: SCHEDULE_TYPE_OPTIONS,');
    expect(source).toContain('uploadSourceOptions: JOB_UPLOAD_SOURCE_OPTIONS,');
    expect(source).not.toContain('const JOB_SCHEDULE_TYPE_OPTIONS =');
    expect(source).not.toContain('const JOB_UPLOAD_SOURCE_SELECT_OPTIONS =');
    expect(source).not.toContain('SCHEDULE_TYPE_OPTIONS.map((item) => ({');
    expect(source).not.toContain('JOB_UPLOAD_SOURCE_OPTIONS.map((item) => ({');
  });
});
