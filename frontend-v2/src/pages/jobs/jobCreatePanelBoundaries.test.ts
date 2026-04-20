import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOB_CREATE_PANEL_FILE = path.resolve(process.cwd(), 'src/pages/jobs/JobCreatePanel.tsx');
const JOBS_MAIN_SECTION_PROPS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMainSectionProps.ts',
);

describe('JobCreatePanel boundaries', () => {
  it('groups panel props by form, workflow, resources, state, handlers, and options', () => {
    const source = fs.readFileSync(JOB_CREATE_PANEL_FILE, 'utf8');

    expect(source).toContain('type JobCreatePanelFormProps = {');
    expect(source).toContain('type JobCreatePanelWorkflowProps = {');
    expect(source).toContain('type JobCreatePanelResourcesProps = {');
    expect(source).toContain('type JobCreatePanelStateProps = {');
    expect(source).toContain('type JobCreatePanelHandlersProps = {');
    expect(source).toContain('type JobCreatePanelOptionsProps = {');
    expect(source).toContain('form: JobCreatePanelFormProps;');
    expect(source).toContain('workflow: JobCreatePanelWorkflowProps;');
    expect(source).toContain('resources: JobCreatePanelResourcesProps;');
    expect(source).toContain('state: JobCreatePanelStateProps;');
    expect(source).toContain('handlers: JobCreatePanelHandlersProps;');
    expect(source).toContain('options: JobCreatePanelOptionsProps;');
    expect(source).toContain('export function JobCreatePanel({');
    expect(source).toContain('  options,');
    expect(source).toContain('}: JobCreatePanelProps) {');
  });

  it('consumes strategy labels through options instead of raw strategy resources', () => {
    const panelSource = fs.readFileSync(JOB_CREATE_PANEL_FILE, 'utf8');
    const builderSource = fs.readFileSync(JOBS_MAIN_SECTION_PROPS_FILE, 'utf8');
    const jobCreateBuilderSection =
      builderSource.match(
        /export function buildJobCreatePanelProps[\s\S]*?(?=export function buildJobsWorkspaceTabsProps)/,
      )?.[0] ?? '';

    expect(panelSource).not.toContain('strategies: Strategy[];');
    expect(panelSource).not.toContain('resources.strategies');
    expect(panelSource).toContain('options={[...options.strategyOptions]}');

    expect(jobCreateBuilderSection).toContain('strategyOptions: controller.queries.strategySelectOptions,');
    expect(jobCreateBuilderSection).not.toContain('getStrategySelectOptions(controller.queries.strategies)');
    expect(jobCreateBuilderSection).not.toContain('strategies: controller.queries.strategies,');
  });
});
