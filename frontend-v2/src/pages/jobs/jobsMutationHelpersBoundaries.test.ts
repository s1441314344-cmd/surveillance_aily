import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_MUTATION_HELPERS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/jobsMutationHelpers.ts',
);

describe('jobsMutationHelpers boundaries', () => {
  it('groups cache and feedback dependencies instead of using positional arguments', () => {
    const source = fs.readFileSync(JOBS_MUTATION_HELPERS_FILE, 'utf8');

    expect(source).toContain('type JobsMutationHelperCacheParams = {');
    expect(source).toContain('type JobsMutationHelperFeedbackParams = {');

    expect(source).toContain(
      'export const invalidateJobsQueries = async ({ queryClient }: JobsMutationHelperCacheParams) => {',
    );
    expect(source).toContain(
      'export const invalidateScheduleQueries = async ({ queryClient }: JobsMutationHelperCacheParams) => {',
    );
    expect(source).toContain('export const createJobsApiErrorHandler =');
    expect(source).toContain('feedback: JobsMutationHelperFeedbackParams;');
    expect(source).toContain('const { message } = feedback;');

    expect(source).not.toContain('export const invalidateJobsQueries = async (queryClient: QueryClient) => {');
    expect(source).not.toContain(
      'export const invalidateScheduleQueries = async (queryClient: QueryClient) => {',
    );
    expect(source).not.toContain(
      '(message: MessageInstance, fallback: string) => (error: Error) => {',
    );
  });
});
