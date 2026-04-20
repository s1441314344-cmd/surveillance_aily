import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listUsers } from '@/shared/api/users';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';

type UseUsersQueryStateParams = {
  canManageUsers: boolean;
};

export function useUsersQueryState({ canManageUsers }: UseUsersQueryStateParams) {
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    enabled: canManageUsers,
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const userStats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((item) => item.is_active).length,
      inactive: users.filter((item) => !item.is_active).length,
      admins: users.filter((item) => item.roles.includes('system_admin')).length,
    }),
    [users],
  );

  const usersError = usersQuery.error ? getApiErrorMessage(usersQuery.error, '用户列表加载失败') : null;

  return {
    usersQuery,
    users,
    userStats,
    usersError,
  };
}
