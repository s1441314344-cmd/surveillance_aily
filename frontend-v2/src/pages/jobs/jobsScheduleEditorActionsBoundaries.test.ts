import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_JOBS_SCHEDULE_EDITOR_ACTIONS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobsScheduleEditorActions.ts',
);

describe('useJobsScheduleEditorActions boundaries', () => {
  it('groups schedule editor dependencies into form, draftState, and mutations', () => {
    const source = fs.readFileSync(USE_JOBS_SCHEDULE_EDITOR_ACTIONS_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobsScheduleEditorActionsParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobsScheduleEditorActionsFormParams = {');
    expect(source).toContain('type UseJobsScheduleEditorActionsDraftStateParams = {');
    expect(source).toContain('type UseJobsScheduleEditorActionsMutationsParams = {');

    expect(params).toContain('form: UseJobsScheduleEditorActionsFormParams;');
    expect(params).toContain('draftState: UseJobsScheduleEditorActionsDraftStateParams;');
    expect(params).toContain('mutations: UseJobsScheduleEditorActionsMutationsParams;');

    expect(params).not.toContain('scheduleEditForm: FormInstance<EditScheduleFormValues>;');
    expect(params).not.toContain('editingSchedule: JobSchedule | null;');
    expect(params).not.toContain(
      "updateScheduleMutation: ReturnType<typeof useJobsMutationState>['updateScheduleMutation'];",
    );

    expect(source).toContain('form.scheduleEditForm.setFieldsValue({');
    expect(source).toContain('form.scheduleEditForm.resetFields();');
    expect(source).toContain('if (!draftState.editingSchedule) {');
    expect(source).toContain('draftState.setEditScheduleType(');
    expect(source).toContain('draftState.setEditingSchedule(');
    expect(source).toContain('await mutations.updateScheduleMutation.mutateAsync({');
  });
});
