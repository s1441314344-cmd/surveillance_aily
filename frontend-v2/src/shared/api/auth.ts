import { apiClient } from './client';
import type { AuthApiUser, TokenSessionResponse } from '@/shared/auth/session';

export type AuthUserResponse = AuthApiUser;
export type LoginResponse = TokenSessionResponse;

export async function login(payload: { username: string; password: string }) {
  const response = await apiClient.post<LoginResponse>('/api/auth/login', payload);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await apiClient.get<AuthUserResponse>('/api/me');
  return response.data;
}
