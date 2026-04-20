import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_SUBMIT_ACTIONS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsSubmitActions.ts',
);

describe('jobsSubmitActions boundaries', () => {
  it('groups upload submit dependencies into feedback, resources, and mutations', () => {
    const source = fs.readFileSync(JOBS_SUBMIT_ACTIONS_FILE, 'utf8');
    const paramsBlock = source.match(/type JobsSubmitActionsParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type JobsSubmitActionsFeedbackParams = {');
    expect(source).toContain('type JobsSubmitActionsResourcesParams = {');
    expect(source).toContain(
      "type JobsSubmitActionsMutationsParams = ReturnType<typeof useJobsMutationState>;",
    );

    expect(params).toContain('feedback: JobsSubmitActionsFeedbackParams;');
    expect(params).toContain('resources: JobsSubmitActionsResourcesParams;');
    expect(params).toContain('mutations: JobsSubmitActionsMutationsParams;');

    expect(params).not.toContain("message: ReturnType<typeof App.useApp>['message'];");
    expect(params).not.toContain('fileList: UploadFile[];');
    expect(params).not.toContain('selectedCameraInForm: Camera | null;');

    expect(source).toContain('message: feedback.message,');
    expect(source).toContain('camera: resources.selectedCameraInForm,');
    expect(source).toContain('camera: resources.selectedUploadCameraInForm,');
    expect(source).toContain('const files = collectRcFiles(resources.fileList);');
    expect(source).toContain('feedback.message.warning(');
  });
});
