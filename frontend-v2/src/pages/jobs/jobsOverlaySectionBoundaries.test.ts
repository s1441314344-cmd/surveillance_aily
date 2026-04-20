import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_OVERLAY_SECTION_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobsOverlaySection.tsx',
);
const JOBS_OVERLAY_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsOverlaySectionProps.ts',
);

describe('JobsOverlaySection boundaries', () => {
  it('keeps overlay composition separate from prop assembly', () => {
    const source = fs.readFileSync(JOBS_OVERLAY_SECTION_FILE, 'utf8');
    const builderSource = fs.readFileSync(JOBS_OVERLAY_SECTION_PROPS_FILE, 'utf8');

    expect(source).toContain(
      "import { buildJobDetailDrawerProps, buildScheduleEditModalProps } from '@/pages/jobs/jobsOverlaySectionProps';",
    );
    expect(source).toContain('const jobDetailDrawerProps = buildJobDetailDrawerProps(controller);');
    expect(source).toContain('const scheduleEditModalProps = buildScheduleEditModalProps(controller);');
    expect(source).toContain('<JobDetailDrawer {...jobDetailDrawerProps} />');
    expect(source).toContain('<ScheduleEditModal {...scheduleEditModalProps} />');
    expect(source).not.toContain('controller.mutations.updateScheduleMutation.isPending');
    expect(source).not.toContain('controller.queries.strategies');
    expect(source).not.toContain('controller.workspace.editScheduleType');
    expect(source).not.toContain('controller.jobDetail');
    expect(source).not.toContain('controller.handlers.onCloseJobDrawer');

    expect(builderSource).toContain('export function buildJobDetailDrawerProps(');
    expect(builderSource).toContain('export function buildScheduleEditModalProps(');
    expect(builderSource).toContain('modal: {');
    expect(builderSource).toContain('data: {');
    expect(builderSource).toContain('handlers: {');
    expect(builderSource).toContain('form: {');
    expect(builderSource).toContain('workflow: {');
    expect(builderSource).toContain('resources: {');
  });

  it('reuses canonical schedule type options instead of remapping them locally', () => {
    const source = fs.readFileSync(JOBS_OVERLAY_SECTION_PROPS_FILE, 'utf8');

    expect(source).toContain('scheduleTypeOptions: SCHEDULE_TYPE_OPTIONS,');
    expect(source).not.toContain('const JOB_SCHEDULE_TYPE_OPTIONS =');
    expect(source).not.toContain('SCHEDULE_TYPE_OPTIONS.map((item) => ({');
  });
});
