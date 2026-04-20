import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEDULE_EDIT_MODAL_FILE = path.resolve(process.cwd(), 'src/pages/jobs/ScheduleEditModal.tsx');
const JOBS_OVERLAY_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsOverlaySectionProps.ts',
);
const JOB_SCHEDULE_TIME_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobScheduleTimeFields.tsx',
);

describe('ScheduleEditModal boundaries', () => {
  it('groups modal props by modal, form, workflow, resources, handlers, and options', () => {
    const source = fs.readFileSync(SCHEDULE_EDIT_MODAL_FILE, 'utf8');
    const overlayPropsSource = fs.readFileSync(JOBS_OVERLAY_SECTION_PROPS_FILE, 'utf8');

    expect(source).toContain('type ScheduleEditModalModalProps = {');
    expect(source).toContain('type ScheduleEditModalFormProps = {');
    expect(source).toContain('type ScheduleEditModalWorkflowProps = {');
    expect(source).toContain('type ScheduleEditModalResourcesProps = {');
    expect(source).toContain('type ScheduleEditModalHandlersProps = {');
    expect(source).toContain('type ScheduleEditModalOptionsProps = {');
    expect(source).toContain('modal: ScheduleEditModalModalProps;');
    expect(source).toContain('form: ScheduleEditModalFormProps;');
    expect(source).toContain('workflow: ScheduleEditModalWorkflowProps;');
    expect(source).toContain('resources: ScheduleEditModalResourcesProps;');
    expect(source).toContain('handlers: ScheduleEditModalHandlersProps;');
    expect(source).toContain('options: ScheduleEditModalOptionsProps;');
    expect(source).toContain('export function ScheduleEditModal({');
    expect(source).toContain('  options,');
    expect(source).toContain('}: ScheduleEditModalProps) {');

    expect(overlayPropsSource).toContain('export function buildScheduleEditModalProps(');
    expect(overlayPropsSource).toContain('modal: {');
    expect(overlayPropsSource).toContain('form: {');
    expect(overlayPropsSource).toContain('workflow: {');
    expect(overlayPropsSource).toContain('resources: {');
    expect(overlayPropsSource).toContain('handlers: {');
    expect(overlayPropsSource).toContain('options: {');
    expect(overlayPropsSource).toContain(
      'precheckStrategyOptions: controller.queries.strategySelectOptions,',
    );
    expect(overlayPropsSource).not.toContain('getStrategySelectOptions(controller.queries.strategies)');
  });

  it('reuses shared schedule-time fields helper instead of inlining interval/daily fragments', () => {
    const source = fs.readFileSync(SCHEDULE_EDIT_MODAL_FILE, 'utf8');
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
