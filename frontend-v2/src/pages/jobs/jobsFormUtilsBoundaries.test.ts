import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_FORM_UTILS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsFormUtils.ts',
);

describe('jobsFormUtils boundaries', () => {
  it('groups schedule and camera validation dependencies into object params', () => {
    const source = fs.readFileSync(JOBS_FORM_UTILS_FILE, 'utf8');

    expect(source).toContain('type JobsFormUtilsScheduleParams = {');
    expect(source).toContain('type JobsFormUtilsFeedbackParams = {');
    expect(source).toContain('type JobsFormUtilsCameraSelectionParams = {');
    expect(source).toContain('type JobsFormUtilsCameraProtocolParams = {');

    expect(source).toContain(
      'export const getScheduleValue = ({\n  scheduleType,\n  dailyTime,\n  intervalMinutes,\n}: JobsFormUtilsScheduleParams) => {',
    );
    expect(source).toContain(
      'export const requireSelectedCamera = ({\n  cameraId,\n  feedback,\n}: JobsFormUtilsCameraSelectionParams) => {',
    );
    expect(source).toContain(
      'export const requireRtspCamera = ({\n  camera,\n  feedback,\n}: JobsFormUtilsCameraProtocolParams) => {',
    );
    expect(source).toContain('const { message, warningText } = feedback;');

    expect(source).not.toContain(
      'export const getScheduleValue = (\n  scheduleType: UploadFormValues[\'scheduleType\'],',
    );
    expect(source).not.toContain(
      'export const requireSelectedCamera = (\n  cameraId: string | undefined,',
    );
    expect(source).not.toContain(
      'export const requireRtspCamera = (\n  camera: Camera | null,',
    );
  });
});
