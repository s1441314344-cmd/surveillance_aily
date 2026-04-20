import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  Camera,
  CameraStatus,
  CameraStatusLog,
  SignalMonitorConfig,
} from '@/shared/api/cameras';
import type { Strategy } from '@/shared/api/strategies';
import { useCameraCenterQueryState } from '@/pages/cameras/useCameraCenterQueryState';

const mockUseQuery = vi.fn();
const mockUseCameraCenterQueries = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
  };
});

vi.mock('@/pages/cameras/useCameraCenterQueries', () => ({
  useCameraCenterQueries: (...args: unknown[]) => mockUseCameraCenterQueries(...args),
}));

function createCamera(id: string, name: string): Camera {
  return {
    id,
    name,
    location: null,
    ip_address: null,
    port: 554,
    protocol: 'rtsp',
    username: null,
    rtsp_url: null,
    frame_frequency_seconds: 60,
    resolution: '1080p',
    jpeg_quality: 80,
    storage_path: '/tmp',
    has_password: false,
  };
}

function createStatusLog(id: string, cameraId = 'camera-a'): CameraStatusLog {
  return {
    id,
    camera_id: cameraId,
    connection_status: 'online',
    alert_status: 'normal',
    last_error: null,
    created_at: `2026-01-01T00:00:0${id}Z`,
  };
}

describe('useCameraCenterQueryState', () => {
  let camerasData: Camera[];
  let statusListData: CameraStatus[];
  let statusLogsData: CameraStatusLog[];
  let monitorStrategiesData: Strategy[];
  let monitorConfigData: SignalMonitorConfig | null;

  beforeEach(() => {
    camerasData = [];
    statusListData = [];
    statusLogsData = [];
    monitorStrategiesData = [];
    monitorConfigData = null;

    mockUseQuery.mockImplementation(() => ({
      data: camerasData,
      isLoading: false,
    }));

    mockUseCameraCenterQueries.mockImplementation(() => ({
      statusQuery: { data: null, isLoading: false },
      statusListQuery: { data: statusListData, isLoading: false },
      statusLogsQuery: { data: statusLogsData, isLoading: false },
      mediaQuery: { data: [], isLoading: false },
      triggerRulesQuery: { data: [], isLoading: false },
      monitorConfigQuery: { data: monitorConfigData, isLoading: false },
      monitorStrategyQuery: { data: monitorStrategiesData, isLoading: false },
    }));
  });

  it('clamps status logs pagination to the first page when statusLogsPage is less than 1', () => {
    camerasData = [createCamera('camera-a', 'Lobby Camera')];
    statusLogsData = [
      createStatusLog('1'),
      createStatusLog('2'),
      createStatusLog('3'),
      createStatusLog('4'),
      createStatusLog('5'),
    ];

    const { result } = renderHook(() =>
      useCameraCenterQueryState({
        selectedCameraId: 'camera-a',
        cameraSearch: '',
        alertOnly: false,
        statusLogsPage: 0,
      }),
    );

    expect(result.current.pagedStatusLogs.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
  });

  it('falls back to the first page when statusLogsPage is NaN', () => {
    camerasData = [createCamera('camera-a', 'Lobby Camera')];
    statusLogsData = [
      createStatusLog('1'),
      createStatusLog('2'),
      createStatusLog('3'),
      createStatusLog('4'),
      createStatusLog('5'),
    ];

    const { result } = renderHook(() =>
      useCameraCenterQueryState({
        selectedCameraId: 'camera-a',
        cameraSearch: '',
        alertOnly: false,
        statusLogsPage: Number.NaN,
      }),
    );

    expect(result.current.pagedStatusLogs.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
  });
});
