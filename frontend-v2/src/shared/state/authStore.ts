import { create } from 'zustand';

type User = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
};

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setSession: (payload: { token: string; refreshToken: string; user: User }) => void;
  updateUser: (user: User) => void;
  logout: () => void;
};

const STORAGE_KEY = 'surveillance-v2-auth';

function loadInitialState(): Pick<AuthState, 'token' | 'refreshToken' | 'user' | 'isAuthenticated'> {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { token: null, refreshToken: null, user: null, isAuthenticated: false };
  }

  try {
    const parsed = JSON.parse(raw) as Pick<AuthState, 'token' | 'refreshToken' | 'user' | 'isAuthenticated'>;
    return parsed;
  } catch {
    return { token: null, refreshToken: null, user: null, isAuthenticated: false };
  }
}

function persistState(
  token: string | null,
  refreshToken: string | null,
  user: User | null,
  isAuthenticated: boolean,
) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token,
      refreshToken,
      user,
      isAuthenticated,
    }),
  );
}

const initialState = loadInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setSession: ({ token, refreshToken, user }) =>
    set(() => {
      const next = {
        token,
        refreshToken,
        user,
        isAuthenticated: true,
      };
      persistState(next.token, next.refreshToken, next.user, next.isAuthenticated);
      return next;
    }),
  updateUser: (user) =>
    set((state) => {
      const next = {
        ...state,
        user,
      };
      persistState(next.token, next.refreshToken, next.user, next.isAuthenticated);
      return next;
    }),
  logout: () =>
    set(() => {
      persistState(null, null, null, false);
      return {
        token: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      };
    }),
}));
