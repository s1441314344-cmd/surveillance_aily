import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_CREATE_CAMERA_FIELD_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobCreateCameraField.tsx',
);
const JOB_CREATE_PANEL_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobCreatePanel.tsx');
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);
const JOB_CREATE_UPLOAD_FIELDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/JobCreateUploadFields.tsx',
);
const JOBS_QUERY_UTILS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/jobsQueryUtils.ts');

describe('job camera select options boundaries', () => {
  it('reuses a shared camera options helper, but assembles both create/upload camera options only behind the builder layer', () => {
    const cameraFieldSource = fs.readFileSync(JOB_CREATE_CAMERA_FIELD_FILE, 'utf8');
    const panelSource = fs.readFileSync(JOB_CREATE_PANEL_FILE, 'utf8');
    const mainSectionPropsSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');
    const uploadFieldSource = fs.readFileSync(JOB_CREATE_UPLOAD_FIELDS_FILE, 'utf8');
    const queryUtilsSource = fs.readFileSync(JOBS_QUERY_UTILS_FILE, 'utf8');

    expect(queryUtilsSource).toContain('export function getCameraSelectOptions(cameras: Camera[]): OptionItem[] {');

    expect(cameraFieldSource).not.toContain(`from '@/pages/jobs/jobsQueryUtils';`);
    expect(cameraFieldSource).not.toContain('getCameraSelectOptions(cameras)');
    expect(cameraFieldSource).not.toContain("label: `${item.name} [${item.protocol.toUpperCase()}]");
    expect(cameraFieldSource).toContain('type JobCreateCameraOptionsProps = {');
    expect(cameraFieldSource).toContain('options: JobCreateCameraOptionsProps;');
    expect(cameraFieldSource).toContain('options={[...options.cameraOptions]}');

    expect(panelSource).not.toContain(`from '@/pages/jobs/jobsQueryUtils';`);
    expect(panelSource).not.toContain('getCameraSelectOptions(resources.cameras)');
    expect(panelSource).not.toContain("label: `${item.name} [${item.protocol.toUpperCase()}]");
    expect(panelSource).toContain('<JobCreateCameraField');
    expect(panelSource).toContain('options={{');
    expect(panelSource).toContain('cameraOptions: options.cameraOptions,');

    expect(mainSectionPropsSource).toContain(`from '@/pages/jobs/jobsQueryUtils';`);
    expect(mainSectionPropsSource).toContain('cameraOptions: getCameraSelectOptions(controller.queries.cameras),');

    expect(uploadFieldSource).not.toContain(`from '@/pages/jobs/jobsQueryUtils';`);
    expect(uploadFieldSource).not.toContain('getCameraSelectOptions(resources.cameras)');
    expect(uploadFieldSource).toContain('options={[');
  });
});
