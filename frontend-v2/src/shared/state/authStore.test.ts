import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './authStore';

const STORAGE_KEY = 'surveillance-v2-auth';

const demoUser = {
  id: 'u-1',
  username: 'tester',
  displayName: '测试用户',
  roles: ['task_operator'],
};

describe('useAuthStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('persists session when setSession is called', () => {
    useAuthStore.getState().setSession({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: demoUser,
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.user).toEqual(demoUser);
    expect(state.isAuthenticated).toBe(true);

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    expect(persisted.token).toBe('access-token');
    expect(persisted.refreshToken).toBe('refresh-token');
    expect(persisted.user).toEqual(demoUser);
    expect(persisted.isAuthenticated).toBe(true);
  });

  it('updates user and keeps token state', () => {
    useAuthStore.getState().setSession({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: demoUser,
    });

    const nextUser = { ...demoUser, displayName: '巡检员A' };
    useAuthStore.getState().updateUser(nextUser);

    const state = useAuthStore.getState();
    expect(state.token).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.user).toEqual(nextUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('clears state and storage on logout', () => {
    useAuthStore.getState().setSession({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: demoUser,
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    expect(persisted).toEqual({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });
});
