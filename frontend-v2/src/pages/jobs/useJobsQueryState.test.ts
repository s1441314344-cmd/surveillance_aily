import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useJobsQueryState } from '@/pages/jobs/useJobsQueryState';

const mockUseQuery = vi.fn();
const mockListStrategies = vi.fn();
const mockListCameras = vi.fn();
const mockListJobs = vi.fn();
const mockListJobSchedules = vi.fn();
const mockGetJob = vi.fn();
const mockUseJobsQueryDerivedState = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

vi.mock('@/shared/api/strategies', () => ({
  listStrategies: (...args: unknown[]) => mockListStrategies(...args),
}));

vi.mock('@/shared/api/cameras', () => ({
  listCameras: (...args: unknown[]) => mockListCameras(...args),
}));

vi.mock('@/shared/api/jobs', () => ({
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  listJobSchedules: (...args: unknown[]) => mockListJobSchedules(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
}));

vi.mock('@/pages/jobs/jobsQueryDerivedState', () => ({
  useJobsQueryDerivedState: (...args: unknown[]) => mockUseJobsQueryDerivedState(...args),
}));

type QueryOptions = {
  enabled?: boolean;
  queryFn: () => Promise<unknown> | unknown;
  queryKey: readonly unknown[];
};

function createParams(selectedJobId: string | null) {
  return {
    queueFilters: {
      statusFilter: 'all',
      strategyFilter: 'all',
      triggerModeFilter: 'all',
      cameraFilter: 'all',
      scheduleFilter: 'all',
      createdFromFilter: '',
      createdToFilter: '',
    },
    scheduleFilters: {
      scheduleStatusFilter: 'all',
      scheduleCameraFilter: 'all',
      scheduleStrategyFilter: 'all',
    },
    selection: {
      selectedJobId,
    },
    workflow: {
      taskMode: 'upload' as const,
      uploadSource: 'local_file' as const,
      selectedCameraIdInForm: undefined,
      selectedUploadCameraIdInForm: undefined,
    },
  };
}

describe('useJobsQueryState behavior', () => {
  let selectedJobQueryOptions: QueryOptions | null;

  beforeEach(() => {
    selectedJobQueryOptions = null;

    mockUseQuery.mockReset();
    mockListStrategies.mockReset();
    mockListCameras.mockReset();
    mockListJobs.mockReset();
    mockListJobSchedules.mockReset();
    mockGetJob.mockReset();
    mockUseJobsQueryDerivedState.mockReset();

    mockListStrategies.mockResolvedValue([]);
    mockListCameras.mockResolvedValue([]);
    mockListJobs.mockResolvedValue([]);
    mockListJobSchedules.mockResolvedValue([]);
    mockGetJob.mockResolvedValue({ id: 'job-1' });
    mockUseJobsQueryDerivedState.mockReturnValue({});

    mockUseQuery.mockImplementation((options: QueryOptions) => {
      if (options.queryKey[0] === 'job-detail') {
        selectedJobQueryOptions = options;
      }

      return {
        data: undefined,
        isLoading: false,
      };
    });
  });

  it('keeps selected job query disabled and rejects safely when no job is selected', async () => {
    renderHook(() => useJobsQueryState(createParams(null)));

    expect(selectedJobQueryOptions?.queryKey).toEqual(['job-detail', null]);
    expect(selectedJobQueryOptions?.enabled).toBe(false);
    await expect(selectedJobQueryOptions?.queryFn()).rejects.toThrow('selectedJobId is required');
    expect(mockGetJob).not.toHaveBeenCalled();
  });

  it('queries the selected job detail with the selected job id when enabled', async () => {
    renderHook(() => useJobsQueryState(createParams('job-1')));

    expect(selectedJobQueryOptions?.queryKey).toEqual(['job-detail', 'job-1']);
    expect(selectedJobQueryOptions?.enabled).toBe(true);
    await expect(selectedJobQueryOptions?.queryFn()).resolves.toEqual({ id: 'job-1' });
    expect(mockGetJob).toHaveBeenCalledWith('job-1');
  });
});
