import fs from 'node:fs';
import path from 'node:path';
import { act, renderHook } from '@testing-library/react';
import type { UseMutationResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useJobsWorkspaceHandlers } from '@/pages/jobs/useJobsWorkspaceHandlers';
import type { JobSchedule } from '@/shared/api/jobs';

const USE_JOBS_WORKSPACE_HANDLERS_FILE = path.resolve(
  process.cwd(),
  'src/pages/jobs/useJobsWorkspaceHandlers.ts',
);

function createMutationMock<TVariables>() {
  return {
    mutate: vi.fn<(value: TVariables) => void>(),
  } as unknown as UseMutationResult<unknown, Error, TVariables, unknown>;
}

function createParams() {
  return {
    queueFilters: {
      setScheduleFilter: vi.fn(),
      setTriggerModeFilter: vi.fn(),
      setCreatedFromFilter: vi.fn(),
      setCreatedToFilter: vi.fn(),
      setStatusFilter: vi.fn(),
      setStrategyFilter: vi.fn(),
      setCameraFilter: vi.fn(),
      handleResetQueueFilters: vi.fn(),
    },
    scheduleFilters: {
      setScheduleStatusFilter: vi.fn(),
      setScheduleCameraFilter: vi.fn(),
      setScheduleStrategyFilter: vi.fn(),
      handleResetScheduleFilters: vi.fn(),
    },
    selection: {
      setSelectedJobId: vi.fn(),
      setSelectedScheduleId: vi.fn(),
      setWorkspaceTab: vi.fn(),
      handleOpenScheduleEditor: vi.fn(),
    },
    mutations: {
      cancelMutation: createMutationMock<string>(),
      retryMutation: createMutationMock<string>(),
      runScheduleNowMutation: createMutationMock<string>(),
      scheduleStatusMutation: createMutationMock<{ scheduleId: string; status: string }>(),
      deleteScheduleMutation: createMutationMock<string>(),
    },
  };
}

describe('useJobsWorkspaceHandlers boundaries', () => {
  it('groups hook params into queueFilters, scheduleFilters, selection, and mutations', () => {
    const source = fs.readFileSync(USE_JOBS_WORKSPACE_HANDLERS_FILE, 'utf8');
    const paramsBlock =
      source.match(/type UseJobsWorkspaceHandlersParams = \{([\s\S]*?)\n\};/) ?? [];
    const params = paramsBlock[1] ?? '';

    expect(source).toContain('type UseJobsWorkspaceHandlersQueueFiltersParams = {');
    expect(source).toContain('type UseJobsWorkspaceHandlersScheduleFiltersParams = {');
    expect(source).toContain('type UseJobsWorkspaceHandlersSelectionParams = {');
    expect(source).toContain('type UseJobsWorkspaceHandlersMutationsParams = {');

    expect(params).toContain('queueFilters: UseJobsWorkspaceHandlersQueueFiltersParams;');
    expect(params).toContain('scheduleFilters: UseJobsWorkspaceHandlersScheduleFiltersParams;');
    expect(params).toContain('selection: UseJobsWorkspaceHandlersSelectionParams;');
    expect(params).toContain('mutations: UseJobsWorkspaceHandlersMutationsParams;');

    expect(params).not.toContain('setScheduleFilter: (value: string) => void;');
    expect(params).not.toContain('setScheduleStatusFilter: (value: string) => void;');
    expect(params).not.toContain('setSelectedJobId: (value: string | null) => void;');
    expect(params).not.toContain('cancelMutation: UseMutationResult<unknown, Error, string, unknown>;');
  });

  it('sets trigger mode to schedule when queue schedule filter selects a concrete schedule', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));

    act(() => {
      result.current.onQueueScheduleChange('schedule-1');
    });

    expect(params.queueFilters.setScheduleFilter).toHaveBeenCalledWith('schedule-1');
    expect(params.queueFilters.setTriggerModeFilter).toHaveBeenCalledWith('schedule');
  });

  it('clears both queue date range fields together', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));

    act(() => {
      result.current.onClearDateRange();
    });

    expect(params.queueFilters.setCreatedFromFilter).toHaveBeenCalledWith('');
    expect(params.queueFilters.setCreatedToFilter).toHaveBeenCalledWith('');
  });

  it('does not force schedule trigger mode when queue schedule filter resets to all', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));

    act(() => {
      result.current.onQueueScheduleChange('all');
    });

    expect(params.queueFilters.setScheduleFilter).toHaveBeenCalledWith('all');
    expect(params.queueFilters.setTriggerModeFilter).not.toHaveBeenCalled();
  });

  it('switches to queue and scopes filters when viewing jobs for a schedule', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));

    act(() => {
      result.current.onScheduleViewJobs('schedule-9');
    });

    expect(params.selection.setWorkspaceTab).toHaveBeenCalledWith('queue');
    expect(params.queueFilters.setTriggerModeFilter).toHaveBeenCalledWith('schedule');
    expect(params.queueFilters.setScheduleFilter).toHaveBeenCalledWith('schedule-9');
    expect(params.selection.setSelectedJobId).toHaveBeenCalledWith(null);
  });

  it('keeps schedule view jobs scoped to queue state without mutating schedule scope', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));

    act(() => {
      result.current.onScheduleViewJobs('schedule-9');
    });

    expect(params.selection.setSelectedScheduleId).not.toHaveBeenCalled();
    expect(params.scheduleFilters.setScheduleStatusFilter).not.toHaveBeenCalled();
    expect(params.scheduleFilters.setScheduleCameraFilter).not.toHaveBeenCalled();
    expect(params.scheduleFilters.setScheduleStrategyFilter).not.toHaveBeenCalled();
    expect(params.mutations.cancelMutation.mutate).not.toHaveBeenCalled();
    expect(params.mutations.retryMutation.mutate).not.toHaveBeenCalled();
    expect(params.mutations.runScheduleNowMutation.mutate).not.toHaveBeenCalled();
    expect(params.mutations.scheduleStatusMutation.mutate).not.toHaveBeenCalled();
    expect(params.mutations.deleteScheduleMutation.mutate).not.toHaveBeenCalled();
  });

  it('forwards edit schedule requests through the selection group', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));
    const schedule = { id: 'schedule-1' } as JobSchedule;

    act(() => {
      result.current.onOpenScheduleEditor(schedule);
    });

    expect(params.selection.handleOpenScheduleEditor).toHaveBeenCalledWith(schedule);
  });

  it('keeps schedule status mutation payload shape stable', () => {
    const params = createParams();
    const { result } = renderHook(() => useJobsWorkspaceHandlers(params));

    act(() => {
      result.current.onToggleScheduleStatus('schedule-2', 'paused');
    });

    expect(params.mutations.scheduleStatusMutation.mutate).toHaveBeenCalledWith({
      scheduleId: 'schedule-2',
      status: 'paused',
    });
  });

  it('builds queue, schedule, and overlay handlers through dedicated builders', () => {
    const source = fs.readFileSync(USE_JOBS_WORKSPACE_HANDLERS_FILE, 'utf8');

    expect(source).toContain('function buildQueueHandlers({');
    expect(source).toContain('function buildScheduleHandlers({');
    expect(source).toContain('function buildOverlayHandlers({');
    expect(source).toContain('const queueHandlers = buildQueueHandlers({');
    expect(source).toContain('const scheduleHandlers = buildScheduleHandlers({');
    expect(source).toContain('const overlayHandlers = buildOverlayHandlers({');
    expect(source).toContain('...queueHandlers,');
    expect(source).toContain('...scheduleHandlers,');
    expect(source).toContain('...overlayHandlers,');
  });
});
