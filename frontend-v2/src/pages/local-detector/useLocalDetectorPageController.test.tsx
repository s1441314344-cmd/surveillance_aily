import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalDetectorPageController } from '@/pages/local-detector/useLocalDetectorPageController';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useMutation: (...args: unknown[]) => mockUseMutation(...args),
  };
});

vi.mock('@/shared/hooks/useObjectUrl', () => ({
  useObjectUrl: () => null,
}));

function createConfigQueryData() {
  return {
    config: {
      model_profile: 'speed' as const,
      preprocess_mode: 'auto' as const,
      score_threshold: 0.35,
      nms_threshold: 0.45,
      default_person_threshold: 0.35,
      input_size: 640,
      auto_download: false,
      model_name: '',
      model_path: '',
      model_url: '',
    },
    model_profile_options: [],
    preprocess_mode_options: [],
  };
}

function setupController(options: { ready: boolean }) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[1] === 'health') {
      return {
        data: { status: 'ok', ready: options.ready },
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      };
    }

    if (queryKey[1] === 'config') {
      return {
        data: createConfigQueryData(),
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      };
    }

    if (queryKey[1] === 'cameras') {
      return {
        data: [],
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      };
    }

    throw new Error(`unexpected query key: ${queryKey.join('/')}`);
  });

  return renderHook(() => useLocalDetectorPageController());
}

describe('useLocalDetectorPageController', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseMutation.mockImplementation(() => ({
      isPending: false,
      mutate: vi.fn(),
    }));
  });

  it('disables detection when the local detector service is not ready', () => {
    const { result } = setupController({ ready: false });

    act(() => {
      result.current.actions.handleSelectUpload(new File(['demo'], 'demo.jpg', { type: 'image/jpeg' }));
    });

    expect(result.current.options.canRunDetect).toBe(false);
  });

  it('allows detection when a file is selected and the service is ready', () => {
    const { result } = setupController({ ready: true });

    act(() => {
      result.current.actions.handleSelectUpload(new File(['demo'], 'demo.jpg', { type: 'image/jpeg' }));
    });

    expect(result.current.options.canRunDetect).toBe(true);
  });
});
