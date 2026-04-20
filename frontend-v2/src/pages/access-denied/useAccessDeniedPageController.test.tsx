import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccessDeniedPageController } from '@/pages/access-denied/useAccessDeniedPageController';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useAccessDeniedPageController', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('navigates back to dashboard', () => {
    const { result } = renderHook(() => useAccessDeniedPageController(), { wrapper });

    act(() => {
      result.current.handleBackToDashboard();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
