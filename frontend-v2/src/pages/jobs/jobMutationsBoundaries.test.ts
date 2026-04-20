import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_JOB_MUTATIONS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobMutations.ts',
);

describe('useJobMutations boundaries', () => {
  it('groups mutation dependencies into forms, feedback, and jobWorkflow', () => {
    const source = fs.readFileSync(USE_JOB_MUTATIONS_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobMutationsParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobMutationsFormsParams = {');
    expect(source).toContain('type UseJobMutationsFeedbackParams = {');
    expect(source).toContain('type UseJobMutationsJobWorkflowParams = {');

    expect(params).toContain('forms: UseJobMutationsFormsParams;');
    expect(params).toContain('feedback: UseJobMutationsFeedbackParams;');
    expect(params).toContain('jobWorkflow: UseJobMutationsJobWorkflowParams;');

    expect(params).not.toContain('form: FormInstance<UploadFormValues>;');
    expect(params).not.toContain('message: MessageInstance;');
    expect(params).not.toContain('setFileList: (value: UploadFile[]) => void;');
    expect(params).not.toContain('setSelectedJobId: (value: string | null) => void;');

    expect(source).toContain('const { form } = forms;');
    expect(source).toContain('const { message } = feedback;');
    expect(source).toContain('const { setFileList, setSelectedJobId } = jobWorkflow;');
  });
});
