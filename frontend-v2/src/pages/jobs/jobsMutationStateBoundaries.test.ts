import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_JOBS_MUTATION_STATE_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobsMutationState.ts',
);

describe('useJobsMutationState boundaries', () => {
  it('groups mutation dependencies into forms, jobWorkflow, and scheduleWorkflow', () => {
    const source = fs.readFileSync(USE_JOBS_MUTATION_STATE_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobsMutationStateParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobsMutationStateFormsParams = {');
    expect(source).toContain('type UseJobsMutationStateJobWorkflowParams = {');
    expect(source).toContain('type UseJobsMutationStateScheduleWorkflowParams = {');

    expect(params).toContain('forms: UseJobsMutationStateFormsParams;');
    expect(params).toContain('jobWorkflow: UseJobsMutationStateJobWorkflowParams;');
    expect(params).toContain('scheduleWorkflow: UseJobsMutationStateScheduleWorkflowParams;');

    expect(params).not.toContain('form: FormInstance<UploadFormValues>;');
    expect(params).not.toContain('scheduleEditForm: FormInstance<EditScheduleFormValues>;');
    expect(params).not.toContain('setFileList: (value: UploadFile[]) => void;');
    expect(params).not.toContain('setEditingSchedule: (value: JobSchedule | null) => void;');

    expect(source).toContain('form: forms.form,');
    expect(source).toContain('setFileList: jobWorkflow.setFileList,');
    expect(source).toContain('setSelectedJobId: jobWorkflow.setSelectedJobId,');
    expect(source).toContain('scheduleEditForm: forms.scheduleEditForm,');
    expect(source).toContain('setTriggerModeFilter: scheduleWorkflow.setTriggerModeFilter,');
    expect(source).toContain('setScheduleFilter: scheduleWorkflow.setScheduleFilter,');
    expect(source).toContain('setEditingSchedule: scheduleWorkflow.setEditingSchedule,');
  });
});
