import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_JOBS_FORM_ACTION_STATE_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobsFormActionState.ts',
);

describe('useJobsFormActionState boundaries', () => {
  it('groups form action dependencies into forms, workflow, resources, and draftState', () => {
    const source = fs.readFileSync(USE_JOBS_FORM_ACTION_STATE_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobsFormActionStateParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobsFormActionStateFormsParams = {');
    expect(source).toContain('type UseJobsFormActionStateWorkflowParams = {');
    expect(source).toContain('type UseJobsFormActionStateResourcesParams = {');
    expect(source).toContain('type UseJobsFormActionStateDraftStateParams = {');

    expect(params).toContain('forms: UseJobsFormActionStateFormsParams;');
    expect(params).toContain('workflow: UseJobsFormActionStateWorkflowParams;');
    expect(params).toContain('resources: UseJobsFormActionStateResourcesParams;');
    expect(params).toContain('draftState: UseJobsFormActionStateDraftStateParams;');
    expect(params).toContain("mutations: ReturnType<typeof useJobsMutationState>;");

    expect(params).not.toContain('form: FormInstance<UploadFormValues>;');
    expect(params).not.toContain("taskMode: UploadFormValues['taskMode'];");
    expect(params).not.toContain('fileList: UploadFile[];');
    expect(params).not.toContain('setEditingSchedule: (value: JobSchedule | null) => void;');

    expect(source).toContain('scheduleEditForm: forms.scheduleEditForm,');
    expect(source).toContain('editingSchedule: draftState.editingSchedule,');
    expect(source).toContain('setEditScheduleType: draftState.setEditScheduleType,');
    expect(source).toContain('setEditingSchedule: draftState.setEditingSchedule,');

    expect(source).toContain('fileList: draftState.fileList,');
    expect(source).toContain('selectedCameraInForm: resources.selectedCameraInForm,');
    expect(source).toContain('selectedUploadCameraInForm: resources.selectedUploadCameraInForm,');

    expect(source).toContain('taskMode: workflow.taskMode,');
    expect(source).toContain('uploadSource: workflow.uploadSource,');
    expect(source).toContain('setFileList: draftState.setFileList,');
    expect(source).toContain('form: forms.form,');
  });

  it('keeps internal reset helpers on object params instead of positional arguments', () => {
    const source = fs.readFileSync(USE_JOBS_FORM_ACTION_STATE_FILE, 'utf8');

    expect(source).toContain('function applyTaskModeDefaults({');
    expect(source).toContain('function applyUploadSourceDefaults({');
    expect(source).toContain('nextTaskMode: changedValues.taskMode,');
    expect(source).toContain('uploadSource: changedValues.uploadSource,');

    expect(source).not.toContain("function applyTaskModeDefaults(\n  nextTaskMode: UploadFormValues['taskMode'],");
    expect(source).not.toContain(
      "function applyUploadSourceDefaults(\n  uploadSource: UploadFormValues['uploadSource'] | undefined,",
    );
  });
});
