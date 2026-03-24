import axios from 'axios';
import { useAuthStore } from '@/shared/state/authStore';
import { toStoreSessionPayload, type TokenSessionResponse } from '@/shared/auth/session';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
type RetryableRequestConfig = {
  url?: string;
  headers?: Record<string, string>;
  _retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isAuthEndpoint(url?: string) {
  if (!url) {
    return false;
  }
  return url.includes('/api/auth/login') || url.includes('/api/auth/refresh');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post<TokenSessionResponse>(
        `${baseURL}/api/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 15000 },
      )
      .then((response) => {
        const nextSession = toStoreSessionPayload(response.data);
        useAuthStore.getState().setSession(nextSession);
        return nextSession.token;
      })
      .catch(() => {
        useAuthStore.getState().logout();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const requestConfig = (error.config ?? {}) as RetryableRequestConfig;
    if (status === 401 && !requestConfig._retry && !isAuthEndpoint(requestConfig.url)) {
      requestConfig._retry = true;
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        requestConfig.headers = requestConfig.headers ?? {};
        requestConfig.headers.Authorization = `Bearer ${refreshedToken}`;
        return apiClient.request(requestConfig);
      }
    }
    if (status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
