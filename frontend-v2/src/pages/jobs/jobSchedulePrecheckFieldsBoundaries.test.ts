import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_SCHEDULE_PRECHECK_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobSchedulePrecheckFields.tsx',
);
const JOB_CREATE_SCHEDULE_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobCreateScheduleFields.tsx',
);
const SCHEDULE_EDIT_MODAL_FILE = path.resolve(process.cwd(), 'src/pages/jobs/ScheduleEditModal.tsx');

describe('JobSchedulePrecheckFields boundaries', () => {
  it('extracts shared precheck fields for create and edit schedule flows, with strategy options supplied from parents', () => {
    const hasSharedComponent = fs.existsSync(JOB_SCHEDULE_PRECHECK_FIELDS_FILE);
    const sharedSource = hasSharedComponent
      ? fs.readFileSync(JOB_SCHEDULE_PRECHECK_FIELDS_FILE, 'utf8')
      : '';
    const createSource = fs.readFileSync(JOB_CREATE_SCHEDULE_FIELDS_FILE, 'utf8');
    const editSource = fs.readFileSync(SCHEDULE_EDIT_MODAL_FILE, 'utf8');

    expect(hasSharedComponent).toBe(true);
    expect(sharedSource).toContain('type JobSchedulePrecheckFieldsProps = {');
    expect(sharedSource).toContain('type JobSchedulePrecheckOptionsProps = {');
    expect(sharedSource).toContain('export function JobSchedulePrecheckFields(');
    expect(sharedSource).toContain('options: JobSchedulePrecheckOptionsProps;');
    expect(sharedSource).toContain('options={[...options.precheckStrategyOptions]}');
    expect(sharedSource).not.toContain('strategies.map((item) => ({');

    expect(createSource).toContain(`from '@/pages/jobs/JobSchedulePrecheckFields';`);
    expect(createSource).toContain('<JobSchedulePrecheckFields');
    expect(createSource).toContain('options={{');
    expect(createSource).toContain('precheckStrategyOptions: options.precheckStrategyOptions,');
    expect(createSource).not.toContain('name="precheckStrategyId"');
    expect(createSource).not.toContain('name="precheckPersonThreshold"');
    expect(createSource).not.toContain('name="precheckSoftNegativeThreshold"');
    expect(createSource).not.toContain('name="precheckStateTtlSeconds"');

    expect(editSource).toContain(`from '@/pages/jobs/JobSchedulePrecheckFields';`);
    expect(editSource).toContain('<JobSchedulePrecheckFields');
    expect(editSource).toContain('options={{');
    expect(editSource).toContain('precheckStrategyOptions: options.precheckStrategyOptions,');
    expect(editSource).not.toContain('name="precheckStrategyId"');
    expect(editSource).not.toContain('name="precheckPersonThreshold"');
    expect(editSource).not.toContain('name="precheckSoftNegativeThreshold"');
    expect(editSource).not.toContain('name="precheckStateTtlSeconds"');
  });
});
