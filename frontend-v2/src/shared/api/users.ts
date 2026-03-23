import { apiClient } from './client';

export type User = {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  roles: string[];
};

export type CreateUserPayload = {
  username: string;
  password: string;
  display_name: string;
  roles: string[];
};

export async function listUsers() {
  const response = await apiClient.get<User[]>('/api/users');
  return response.data;
}

export async function createUser(payload: CreateUserPayload) {
  const response = await apiClient.post<User>('/api/users', payload);
  return response.data;
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  const response = await apiClient.patch<User>(`/api/users/${userId}/status`, {
    is_active: isActive,
  });
  return response.data;
}
