import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginPageController } from '@/pages/login/useLoginPageController';
import { useAuthStore } from '@/shared/state/authStore';

const mockUseMutation = vi.fn();
const mockNavigate = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();
const mockLogin = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: (...args: unknown[]) => mockUseMutation(...args),
  };
});

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: mockMessageSuccess,
          error: mockMessageError,
        },
      }),
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/shared/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useLoginPageController', () => {
  beforeEach(() => {
    mockUseMutation.mockReset();
    mockNavigate.mockReset();
    mockMessageSuccess.mockReset();
    mockMessageError.mockReset();
    mockLogin.mockReset();
    useAuthStore.getState().logout();
  });

  it('stores session and navigates to dashboard after login succeeds', async () => {
    mockUseMutation.mockImplementation(({ onSuccess, mutationFn }) => ({
      isPending: false,
      mutateAsync: async (values: unknown) => {
        const response = {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          token_type: 'bearer',
          user: {
            id: 'user-1',
            username: 'admin',
            display_name: '管理员',
            is_active: true,
            roles: ['system_admin'],
          },
        };
        await mutationFn(values);
        onSuccess?.(response);
        return response;
      },
    }));

    const { result } = renderHook(() => useLoginPageController(), { wrapper });

    await act(async () => {
      await result.current.handleFinish({ username: 'admin', password: 'admin123456' });
    });

    expect(mockLogin).toHaveBeenCalledWith({ username: 'admin', password: 'admin123456' });
    expect(useAuthStore.getState().user?.username).toBe('admin');
    expect(mockMessageSuccess).toHaveBeenCalledWith('登录成功');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows normalized error message when login fails', async () => {
    mockUseMutation.mockImplementation(() => ({
      isPending: false,
      mutateAsync: async () => {
        throw new Error('凭证无效');
      },
    }));

    const { result } = renderHook(() => useLoginPageController(), { wrapper });

    await act(async () => {
      await result.current.handleFinish({ username: 'admin', password: 'wrong-password' });
    });

    expect(mockMessageError).toHaveBeenCalledWith('凭证无效');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
