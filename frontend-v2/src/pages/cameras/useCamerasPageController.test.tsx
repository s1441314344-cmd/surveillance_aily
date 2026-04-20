import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCamerasPageController } from '@/pages/cameras/useCamerasPageController';

const mockUseLocation = vi.fn();
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
const mockUseCameraCenterState = vi.fn();
const mockUseCameraUrlSync = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams('cameraId=camera-a&tab=media&debug=1'), mockSetSearchParams],
  };
});

vi.mock('@/pages/cameras/useCameraCenterState', () => ({
  CREATE_CAMERA_ID: '__create__',
  useCameraCenterState: (...args: unknown[]) => mockUseCameraCenterState(...args),
}));

vi.mock('@/pages/cameras/useCameraUrlSync', () => ({
  useCameraUrlSync: (...args: unknown[]) => mockUseCameraUrlSync(...args),
}));

function createControllerState() {
  return {
    form: { __tag: 'form' },
    triggerRuleForm: { __tag: 'trigger-rule-form' },
    monitorConfigForm: { __tag: 'monitor-config-form' },
    selectedCameraId: 'camera-a',
    effectiveSelectedCameraId: 'camera-a',
    cameraListContext: {
      cameras: [{ id: 'camera-a', name: 'Front Gate' }],
      visibleCameras: [{ id: 'camera-a', name: 'Front Gate' }],
      cameraSearch: '',
      setCameraSearch: vi.fn(),
      alertOnly: false,
      setAlertOnly: vi.fn(),
      cameraStatusMap: { 'camera-a': { connection_status: 'online' } },
      statusSummary: [{ label: '在线', count: 1 }],
      camerasLoading: false,
      sweepLoading: false,
      runSweepAllCameras: vi.fn(),
      selectCamera: vi.fn(),
    },
  };
}

describe('useCamerasPageController', () => {
  beforeEach(() => {
    mockUseLocation.mockReset();
    mockNavigate.mockReset();
    mockSetSearchParams.mockReset();
    mockUseCameraCenterState.mockReset();
    mockUseCameraUrlSync.mockReset();

    mockUseLocation.mockReturnValue({
      pathname: '/cameras/media',
      search: '?cameraId=camera-a&tab=media&debug=1',
    });
    mockUseCameraCenterState.mockReturnValue(createControllerState());
  });

  it('navigates to another cameras section while preserving the existing query string', () => {
    const { result } = renderHook(() => useCamerasPageController());

    act(() => {
      result.current.actions.navigateToSection('diagnostics');
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/cameras/diagnostics',
      search: '?cameraId=camera-a&tab=media&debug=1',
    });
  });

  it('navigates to create camera mode on the devices section', () => {
    const { result } = renderHook(() => useCamerasPageController());

    act(() => {
      result.current.actions.handleCreateCamera();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/cameras/devices?cameraId=__create__');
  });
});
