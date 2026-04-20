import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_CREATE_SCHEDULE_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobCreateScheduleFields.tsx',
);
const JOB_CREATE_PANEL_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobCreatePanel.tsx');
const JOB_SCHEDULE_TIME_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobScheduleTimeFields.tsx',
);

describe('JobCreateScheduleFields boundaries', () => {
  it('groups schedule field props by workflow, resources, and options', () => {
    const source = fs.readFileSync(JOB_CREATE_SCHEDULE_FIELDS_FILE, 'utf8');
    const panelSource = fs.readFileSync(JOB_CREATE_PANEL_FILE, 'utf8');

    expect(source).toContain('type JobCreateScheduleWorkflowProps = {');
    expect(source).toContain('type JobCreateScheduleResourcesProps = {');
    expect(source).toContain('type JobCreateScheduleOptionsProps = {');
    expect(source).toContain('workflow: JobCreateScheduleWorkflowProps;');
    expect(source).toContain('resources: JobCreateScheduleResourcesProps;');
    expect(source).toContain('options: JobCreateScheduleOptionsProps;');
    expect(source).toContain(
      'export function JobCreateScheduleFields({ workflow, resources, options }: JobCreateScheduleFieldsProps) {',
    );
    expect(source).toContain('options={[...options.scheduleTypeOptions]}');
    expect(source).not.toContain("import { SCHEDULE_TYPE_OPTIONS } from '@/shared/ui';");

    expect(panelSource).toContain('<JobCreateScheduleFields');
    expect(panelSource).toContain('workflow={{');
    expect(panelSource).toContain('resources={{');
    expect(panelSource).toContain('options={{');
  });

  it('reuses shared schedule-time fields helper instead of inlining interval/daily fragments', () => {
    const source = fs.readFileSync(JOB_CREATE_SCHEDULE_FIELDS_FILE, 'utf8');
    const helperSource = fs.readFileSync(JOB_SCHEDULE_TIME_FIELDS_FILE, 'utf8');

    expect(helperSource).toContain('export function JobScheduleTimeFields');
    expect(source).toContain(
      "import { JobScheduleTimeFields } from '@/pages/jobs/JobScheduleTimeFields';",
    );
    expect(source).toContain('<JobScheduleTimeFields scheduleType={workflow.scheduleType} />');
    expect(source).not.toContain('name="intervalMinutes"');
    expect(source).not.toContain('name="dailyTime"');
  });
});
