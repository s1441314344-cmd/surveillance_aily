import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, type FormInstance } from 'antd';
import { createUser, updateUserStatus } from '@/shared/api/users';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';
import { GENERIC_STATE_LABELS } from '@/shared/ui';
import type { CreateUserFormValues } from '@/pages/users/types';

type UseUsersMutationStateParams = {
  form: FormInstance<CreateUserFormValues>;
  setTogglingUserId: (value: string | null) => void;
};

export function useUsersMutationState({ form, setTogglingUserId }: UseUsersMutationStateParams) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (createdUser) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      form.resetFields();
      message.success(`用户 ${createdUser.display_name} 已创建`);
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '创建用户失败'));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, isActive),
    onSuccess: (updatedUser) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      message.success(
        `${updatedUser.display_name} 已${updatedUser.is_active ? GENERIC_STATE_LABELS.enabled : GENERIC_STATE_LABELS.disabled}`,
      );
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, '更新用户状态失败'));
    },
    onSettled: () => {
      setTogglingUserId(null);
    },
  });

  return {
    createMutation,
    statusMutation,
  };
}
