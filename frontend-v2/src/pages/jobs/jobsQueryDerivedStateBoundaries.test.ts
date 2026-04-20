import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_QUERY_DERIVED_STATE_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsQueryDerivedState.ts',
);

describe('useJobsQueryDerivedState boundaries', () => {
  it('groups derived state dependencies into queryData, workflow, and selection', () => {
    const source = fs.readFileSync(JOBS_QUERY_DERIVED_STATE_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobsQueryDerivedStateParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobsQueryDerivedStateQueryDataParams = {');
    expect(source).toContain('type UseJobsQueryDerivedStateWorkflowParams = {');
    expect(source).toContain('type UseJobsQueryDerivedStateSelectionParams = {');

    expect(params).toContain('queryData: UseJobsQueryDerivedStateQueryDataParams;');
    expect(params).toContain('workflow: UseJobsQueryDerivedStateWorkflowParams;');
    expect(params).toContain('selection: UseJobsQueryDerivedStateSelectionParams;');

    expect(params).not.toContain('strategiesData: Strategy[] | undefined;');
    expect(params).not.toContain('taskMode: \'upload\' | \'camera_once\' | \'camera_schedule\';');
    expect(params).not.toContain('selectedCameraIdInForm?: string;');

    expect(source).toContain(
      'const { strategiesData, camerasData, jobsData, schedulesData, selectedJobData } = queryData;',
    );
    expect(source).toContain('const { taskMode, uploadSource } = workflow;');
    expect(source).toContain(
      'const { selectedCameraIdInForm, selectedUploadCameraIdInForm } = selection;',
    );
  });

  it('derives strategy select labels once and exposes them to upper builders', () => {
    const source = fs.readFileSync(JOBS_QUERY_DERIVED_STATE_FILE, 'utf8');

    expect(source).toContain('getStrategySelectOptions');
    expect(source).toContain(
      'const strategySelectOptions = useMemo(() => getStrategySelectOptions(strategies), [strategies]);',
    );
    expect(source).toContain('strategySelectOptions,');
  });
});
