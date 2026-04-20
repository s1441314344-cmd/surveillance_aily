import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_DETAIL_DRAWER_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobDetailDrawer.tsx');
const JOBS_OVERLAY_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsOverlaySectionProps.ts',
);
const JOBS_QUERY_UTILS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/jobsQueryUtils.ts');
const JOBS_TABLE_FORMATTERS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsTableFormatters.ts',
);

describe('JobDetailDrawer boundaries', () => {
  it('groups drawer props and delegates record loading to a dedicated hook', () => {
    const source = fs.readFileSync(JOB_DETAIL_DRAWER_FILE, 'utf8');
    const overlayPropsSource = fs.readFileSync(JOBS_OVERLAY_SECTION_PROPS_FILE, 'utf8');

    expect(source).toContain(
      "import { useJobDetailDrawerState } from '@/pages/jobs/useJobDetailDrawerState';",
    );
    expect(source).toContain('type JobDetailDrawerModalProps = {');
    expect(source).toContain('type JobDetailDrawerDataProps = {');
    expect(source).toContain('type JobDetailDrawerHandlersProps = {');
    expect(source).toContain('modal: JobDetailDrawerModalProps;');
    expect(source).toContain('data: JobDetailDrawerDataProps;');
    expect(source).toContain('handlers: JobDetailDrawerHandlersProps;');
    expect(source).toContain(
      'export function JobDetailDrawer({ modal, data, handlers }: JobDetailDrawerProps) {',
    );
    expect(source).toContain('const drawer = useJobDetailDrawerState({');
    expect(source).toContain('open: modal.open,');
    expect(source).toContain('job: data.job,');
    expect(source).not.toContain("from '@tanstack/react-query';");
    expect(source).not.toContain("from '@/shared/api/records';");

    expect(overlayPropsSource).toContain('export function buildJobDetailDrawerProps(');
    expect(overlayPropsSource).toContain('modal: {');
    expect(overlayPropsSource).toContain('data: {');
    expect(overlayPropsSource).toContain('handlers: {');
  });

  it('reuses a shared date-time formatter instead of redefining local formatting logic', () => {
    const drawerSource = fs.readFileSync(JOB_DETAIL_DRAWER_FILE, 'utf8');
    const queryUtilsSource = fs.readFileSync(JOBS_QUERY_UTILS_FILE, 'utf8');
    const tableFormattersSource = fs.readFileSync(JOBS_TABLE_FORMATTERS_FILE, 'utf8');

    expect(tableFormattersSource).toContain(
      'export function formatDateTime(value: string | null | undefined) {',
    );

    expect(drawerSource).toContain(
      "import { formatDateTime } from '@/pages/jobs/jobsTableFormatters';",
    );
    expect(drawerSource).not.toContain('function formatDateTime(');
    expect(drawerSource).not.toContain('new Date(value).toLocaleString()');

    expect(queryUtilsSource).toContain(
      "import { formatDateTime } from '@/pages/jobs/jobsTableFormatters';",
    );
    expect(queryUtilsSource).not.toContain('function formatDateTime(');
    expect(queryUtilsSource).not.toContain('new Date(value).toLocaleString()');
  });
});
