import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_SCHEDULE_MUTATIONS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useScheduleMutations.ts',
);

describe('useScheduleMutations boundaries', () => {
  it('groups mutation dependencies into forms, feedback, and scheduleWorkflow', () => {
    const source = fs.readFileSync(USE_SCHEDULE_MUTATIONS_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseScheduleMutationsParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseScheduleMutationsFormsParams = {');
    expect(source).toContain('type UseScheduleMutationsFeedbackParams = {');
    expect(source).toContain('type UseScheduleMutationsScheduleWorkflowParams = {');

    expect(params).toContain('forms: UseScheduleMutationsFormsParams;');
    expect(params).toContain('feedback: UseScheduleMutationsFeedbackParams;');
    expect(params).toContain('scheduleWorkflow: UseScheduleMutationsScheduleWorkflowParams;');

    expect(params).not.toContain('form: FormInstance<UploadFormValues>;');
    expect(params).not.toContain('scheduleEditForm: FormInstance<EditScheduleFormValues>;');
    expect(params).not.toContain('message: MessageInstance;');
    expect(params).not.toContain('setTriggerModeFilter: (value: string) => void;');
    expect(params).not.toContain('setScheduleFilter: (value: string) => void;');
    expect(params).not.toContain('setEditingSchedule: (value: JobSchedule | null) => void;');

    expect(source).toContain('const { form, scheduleEditForm } = forms;');
    expect(source).toContain('const { message } = feedback;');
    expect(source).toContain(
      'const { setTriggerModeFilter, setScheduleFilter, setEditingSchedule } = scheduleWorkflow;',
    );
  });
});
