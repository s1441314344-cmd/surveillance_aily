import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USE_JOBS_QUERY_STATE_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobsQueryState.ts',
);

describe('useJobsQueryState boundaries', () => {
  it('groups query dependencies into queueFilters, scheduleFilters, selection, and workflow', () => {
    const source = fs.readFileSync(USE_JOBS_QUERY_STATE_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobsQueryStateParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobsQueryStateQueueFiltersParams = {');
    expect(source).toContain('type UseJobsQueryStateScheduleFiltersParams = {');
    expect(source).toContain('type UseJobsQueryStateSelectionParams = {');
    expect(source).toContain('type UseJobsQueryStateWorkflowParams = {');

    expect(params).toContain('queueFilters: UseJobsQueryStateQueueFiltersParams;');
    expect(params).toContain('scheduleFilters: UseJobsQueryStateScheduleFiltersParams;');
    expect(params).toContain('selection: UseJobsQueryStateSelectionParams;');
    expect(params).toContain('workflow: UseJobsQueryStateWorkflowParams;');

    expect(params).not.toContain('statusFilter: string;');
    expect(params).not.toContain('scheduleStatusFilter: string;');
    expect(params).not.toContain('selectedJobId: string | null;');
    expect(params).not.toContain("taskMode: 'upload' | 'camera_once' | 'camera_schedule';");

    expect(source).toContain('const { selectedJobId } = selection;');
    expect(source).toContain(
      'const { taskMode, uploadSource, selectedCameraIdInForm, selectedUploadCameraIdInForm } = workflow;',
    );
  });

  it('builds query options through dedicated helpers instead of inline useQuery objects', () => {
    const source = fs.readFileSync(USE_JOBS_QUERY_STATE_FILE, 'utf8');

    expect(source).toContain('function buildStrategyQueryOptions() {');
    expect(source).toContain('function buildCamerasQueryOptions() {');
    expect(source).toContain('function buildJobsQueryOptions({');
    expect(source).toContain('function buildSchedulesQueryOptions({');
    expect(source).toContain('function buildSelectedJobQueryOptions({');

    expect(source).toContain('const strategyQuery = useQuery(buildStrategyQueryOptions());');
    expect(source).toContain('const camerasQuery = useQuery(buildCamerasQueryOptions());');
    expect(source).toContain('const jobsQuery = useQuery(buildJobsQueryOptions({');
    expect(source).toContain('const schedulesQuery = useQuery(buildSchedulesQueryOptions({');
    expect(source).toContain('const selectedJobQuery = useQuery(buildSelectedJobQueryOptions({');

    expect(source).not.toContain('const strategyQuery = useQuery({');
    expect(source).not.toContain('const camerasQuery = useQuery({');
    expect(source).not.toContain('const jobsQuery = useQuery({');
    expect(source).not.toContain('const schedulesQuery = useQuery({');
    expect(source).not.toContain('const selectedJobQuery = useQuery({');
  });

  it('keeps jobs and schedules query option builders on a single source of filter truth', () => {
    const source = fs.readFileSync(USE_JOBS_QUERY_STATE_FILE, 'utf8');

    expect(source).toContain('queueFilters: UseJobsQueryStateQueueFiltersParams;');
    expect(source).toContain('scheduleFilters: UseJobsQueryStateScheduleFiltersParams;');
    expect(source).toContain('const jobsListParams = buildJobsListParams(queueFilters);');
    expect(source).toContain('const schedulesListParams = buildSchedulesListParams(scheduleFilters);');
    expect(source).toContain('const jobsQuery = useQuery(buildJobsQueryOptions({\n    queueFilters,\n  }));');
    expect(source).toContain(
      'const schedulesQuery = useQuery(buildSchedulesQueryOptions({\n    scheduleFilters,\n  }));',
    );

    expect(source).not.toContain('jobsListParams: ReturnType<typeof buildJobsListParams>;');
    expect(source).not.toContain('schedulesListParams: ReturnType<typeof buildSchedulesListParams>;');
    expect(source).not.toContain('jobsListParams,\n  }));');
    expect(source).not.toContain('schedulesListParams,\n  }));');
  });
});
