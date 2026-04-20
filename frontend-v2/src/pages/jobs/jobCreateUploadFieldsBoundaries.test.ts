import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_CREATE_UPLOAD_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobCreateUploadFields.tsx',
);
const JOB_CREATE_PANEL_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobCreatePanel.tsx');

describe('JobCreateUploadFields boundaries', () => {
  it('groups upload field props by workflow, resources, state, handlers, and options', () => {
    const source = fs.readFileSync(JOB_CREATE_UPLOAD_FIELDS_FILE, 'utf8');
    const panelSource = fs.readFileSync(JOB_CREATE_PANEL_FILE, 'utf8');

    expect(source).toContain('type JobCreateUploadWorkflowProps = {');
    expect(source).toContain('type JobCreateUploadResourcesProps = {');
    expect(source).toContain('type JobCreateUploadStateProps = {');
    expect(source).toContain('type JobCreateUploadHandlersProps = {');
    expect(source).toContain('type JobCreateUploadOptionsProps = {');
    expect(source).toContain('workflow: JobCreateUploadWorkflowProps;');
    expect(source).toContain('resources: JobCreateUploadResourcesProps;');
    expect(source).toContain('state: JobCreateUploadStateProps;');
    expect(source).toContain('handlers: JobCreateUploadHandlersProps;');
    expect(source).toContain('options: JobCreateUploadOptionsProps;');
    expect(source).toContain('export function JobCreateUploadFields({');
    expect(source).toContain('  options,');
    expect(source).toContain('}: JobCreateUploadFieldsProps) {');

    expect(panelSource).toContain('<JobCreateUploadFields');
    expect(panelSource).toContain('workflow={{');
    expect(panelSource).toContain('resources={{');
    expect(panelSource).toContain('state={{');
    expect(panelSource).toContain('handlers={{');
    expect(panelSource).toContain('options={{');
    expect(panelSource).toContain('uploadSourceOptions: options.uploadSourceOptions,');
    expect(panelSource).toContain('uploadCameraOptions: options.cameraOptions,');
  });
});
