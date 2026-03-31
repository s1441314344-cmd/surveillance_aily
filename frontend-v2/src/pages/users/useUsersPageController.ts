import { useState } from 'react';
import { Form } from 'antd';
import { useAuthStore } from '@/shared/state/authStore';
import { useUsersFormActionState } from '@/pages/users/useUsersFormActionState';
import { useUsersMutationState } from '@/pages/users/useUsersMutationState';
import { useUsersQueryState } from '@/pages/users/useUsersQueryState';
import { type CreateUserFormValues } from '@/pages/users/types';

export function useUsersPageController() {
  const [form] = Form.useForm<CreateUserFormValues>();
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const currentUser = useAuthStore((state) => state.user);
  const canManageUsers = currentUser?.roles.includes('system_admin') ?? false;

  const queries = useUsersQueryState({ canManageUsers });

  const mutations = useUsersMutationState({
    form,
    setTogglingUserId,
  });

  const actions = useUsersFormActionState({
    currentUserId: currentUser?.id,
    togglingUserId,
    setTogglingUserId,
    mutations: {
      createMutation: mutations.createMutation,
      statusMutation: mutations.statusMutation,
    },
  });

  return {
    form,
    currentUser,
    canManageUsers,
    selectedUserId,
    setSelectedUserId,
    queries,
    actions,
  };
}
