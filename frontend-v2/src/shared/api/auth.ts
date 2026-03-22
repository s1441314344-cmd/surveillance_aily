import { apiClient } from './client';

export type AuthUserResponse = {
  id: string;
  username: string;
  display_name: string;
  roles: string[];
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUserResponse;
};

export async function login(payload: { username: string; password: string }) {
  const response = await apiClient.post<LoginResponse>('/api/auth/login', payload);
  return response.data;
}

export async function fetchCurrentUser() {
  const response = await apiClient.get<AuthUserResponse>('/api/me');
  return response.data;
}
