import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_QUEUE_COLUMNS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/useJobQueueColumns.tsx');
const JOB_QUEUE_TABLE_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobQueueTable.tsx');
const SCHEDULE_COLUMNS_FILE = path.resolve(process.cwd(), 'src/pages/jobs/useScheduleColumns.tsx');
const SCHEDULE_TABLE_FILE = path.resolve(process.cwd(), 'src/pages/jobs/ScheduleTable.tsx');
const JOBS_TABLE_EVENT_GUARDS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsTableEventGuards.ts',
);
const JOBS_TABLE_LOOKUPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsTableLookups.ts',
);

describe('jobs columns boundaries', () => {
  it('keeps job queue columns hook grouped by lookups and actions', () => {
    const hookSource = fs.readFileSync(JOB_QUEUE_COLUMNS_FILE, 'utf8');
    const tableSource = fs.readFileSync(JOB_QUEUE_TABLE_FILE, 'utf8');

    expect(hookSource).toContain('export type UseJobQueueColumnsLookupsProps = {');
    expect(hookSource).toContain('export type UseJobQueueColumnsActionsLoadingProps = {');
    expect(hookSource).toContain('export type UseJobQueueColumnsActionsHandlersProps = {');
    expect(hookSource).toContain('export type UseJobQueueColumnsActionsProps = {');
    expect(hookSource).toContain('lookups: UseJobQueueColumnsLookupsProps;');
    expect(hookSource).toContain('actions: UseJobQueueColumnsActionsProps;');
    expect(hookSource).toContain('loading: UseJobQueueColumnsActionsLoadingProps;');
    expect(hookSource).toContain('handlers: UseJobQueueColumnsActionsHandlersProps;');

    expect(tableSource).toContain('lookups: {');
    expect(tableSource).toContain('actions: {');
    expect(tableSource).toContain('loading: {');
    expect(tableSource).toContain('handlers: {');
  });

  it('keeps schedule columns hook grouped by lookups and actions', () => {
    const hookSource = fs.readFileSync(SCHEDULE_COLUMNS_FILE, 'utf8');
    const tableSource = fs.readFileSync(SCHEDULE_TABLE_FILE, 'utf8');

    expect(hookSource).toContain('export type UseScheduleColumnsLookupsProps = {');
    expect(hookSource).toContain('export type UseScheduleColumnsActionsLoadingProps = {');
    expect(hookSource).toContain('export type UseScheduleColumnsActionsHandlersProps = {');
    expect(hookSource).toContain('export type UseScheduleColumnsActionsProps = {');
    expect(hookSource).toContain('lookups: UseScheduleColumnsLookupsProps;');
    expect(hookSource).toContain('actions: UseScheduleColumnsActionsProps;');
    expect(hookSource).toContain('loading: UseScheduleColumnsActionsLoadingProps;');
    expect(hookSource).toContain('handlers: UseScheduleColumnsActionsHandlersProps;');

    expect(tableSource).toContain('lookups: {');
    expect(tableSource).toContain('actions: {');
    expect(tableSource).toContain('loading: {');
    expect(tableSource).toContain('handlers: {');
  });

  it('reuses shared row-click guard helpers across queue and schedule columns', () => {
    const queueSource = fs.readFileSync(JOB_QUEUE_COLUMNS_FILE, 'utf8');
    const scheduleSource = fs.readFileSync(SCHEDULE_COLUMNS_FILE, 'utf8');
    const helperSource = fs.readFileSync(JOBS_TABLE_EVENT_GUARDS_FILE, 'utf8');

    expect(helperSource).toContain('export const withRowClickGuard');
    expect(helperSource).toContain('export const stopRowClickPropagation');

    expect(queueSource).toContain(
      "import { withRowClickGuard } from '@/pages/jobs/jobsTableEventGuards';",
    );
    expect(queueSource).not.toContain('event.stopPropagation();');

    expect(scheduleSource).toContain(
      "import { stopRowClickPropagation, withRowClickGuard } from '@/pages/jobs/jobsTableEventGuards';",
    );
    expect(scheduleSource).not.toContain('event.stopPropagation();');
  });

  it('reuses shared name-map helper across queue and schedule columns', () => {
    const queueSource = fs.readFileSync(JOB_QUEUE_COLUMNS_FILE, 'utf8');
    const scheduleSource = fs.readFileSync(SCHEDULE_COLUMNS_FILE, 'utf8');
    const helperSource = fs.readFileSync(JOBS_TABLE_LOOKUPS_FILE, 'utf8');

    expect(helperSource).toContain('export function buildLookupNameMap');
    expect(helperSource).toContain(
      'export function buildLookupNameMap<T extends { id: string; name: string }>(items: T[]): Map<string, string> {',
    );

    expect(queueSource).toContain(
      "import { buildLookupNameMap } from '@/pages/jobs/jobsTableLookups';",
    );
    expect(queueSource).not.toContain('function buildCameraNameMap');

    expect(scheduleSource).toContain(
      "import { buildLookupNameMap } from '@/pages/jobs/jobsTableLookups';",
    );
    expect(scheduleSource).not.toContain('const buildNameMap =');
  });
});
