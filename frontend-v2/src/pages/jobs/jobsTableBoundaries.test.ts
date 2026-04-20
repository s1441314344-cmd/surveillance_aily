import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_QUEUE_TABLE_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobQueueTable.tsx');
const SCHEDULE_TABLE_FILE = path.resolve(process.cwd(), 'src/pages/jobs/ScheduleTable.tsx');
const JOBS_TABLE_ROW_SELECTION_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsTableRowSelection.ts',
);

describe('jobs table boundaries', () => {
  it('keeps JobQueueTable grouped by data, selection, state, and handlers props', () => {
    const source = fs.readFileSync(JOB_QUEUE_TABLE_FILE, 'utf8');

    expect(source).toContain('type JobQueueTableDataProps = {');
    expect(source).toContain('type JobQueueTableSelectionProps = {');
    expect(source).toContain('type JobQueueTableStateProps = {');
    expect(source).toContain('type JobQueueTableHandlersProps = {');
    expect(source).toContain('data: JobQueueTableDataProps;');
    expect(source).toContain('selection: JobQueueTableSelectionProps;');
    expect(source).toContain('state: JobQueueTableStateProps;');
    expect(source).toContain('handlers: JobQueueTableHandlersProps;');
    expect(source).toContain(
      'export function JobQueueTable({ data, selection, state, handlers }: JobQueueTableProps) {',
    );
  });

  it('keeps ScheduleTable grouped by data, selection, state, and handlers props', () => {
    const source = fs.readFileSync(SCHEDULE_TABLE_FILE, 'utf8');

    expect(source).toContain('type ScheduleTableDataProps = {');
    expect(source).toContain('type ScheduleTableSelectionProps = {');
    expect(source).toContain('type ScheduleTableStateProps = {');
    expect(source).toContain('type ScheduleTableHandlersProps = {');
    expect(source).toContain('data: ScheduleTableDataProps;');
    expect(source).toContain('selection: ScheduleTableSelectionProps;');
    expect(source).toContain('state: ScheduleTableStateProps;');
    expect(source).toContain('handlers: ScheduleTableHandlersProps;');
    expect(source).toContain('export function ScheduleTable({ data, selection, state, handlers }: ScheduleTableProps) {');
  });

  it('reuses a shared selectable row helper instead of duplicating table row selection shells', () => {
    const queueSource = fs.readFileSync(JOB_QUEUE_TABLE_FILE, 'utf8');
    const scheduleSource = fs.readFileSync(SCHEDULE_TABLE_FILE, 'utf8');
    const helperSource = fs.readFileSync(JOBS_TABLE_ROW_SELECTION_FILE, 'utf8');

    expect(helperSource).toContain('export function buildSelectableTableRowProps');
    expect(helperSource).toContain("'aria-selected'");
    expect(helperSource).toContain('table-row-clickable');
    expect(helperSource).toContain('table-row-selected');

    expect(queueSource).toContain(
      "import { buildSelectableTableRowProps } from '@/pages/jobs/jobsTableRowSelection';",
    );
    expect(queueSource).toContain('const rowSelectionProps = buildSelectableTableRowProps<Job>({');
    expect(queueSource).not.toContain('onRow={(record) => ({');
    expect(queueSource).not.toContain('rowClassName={(record) =>');

    expect(scheduleSource).toContain(
      "import { buildSelectableTableRowProps } from '@/pages/jobs/jobsTableRowSelection';",
    );
    expect(scheduleSource).toContain(
      'const rowSelectionProps = buildSelectableTableRowProps<JobSchedule>({',
    );
    expect(scheduleSource).not.toContain('onRow={(record) => ({');
    expect(scheduleSource).not.toContain('rowClassName={(record) =>');
  });
});
