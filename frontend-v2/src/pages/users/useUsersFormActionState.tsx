import { useMemo } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { User } from '@/shared/api/users';
import { StatusBadge, USER_ACTIVE_BADGE_LABELS } from '@/shared/ui';
import { roleColorMap, roleLabelMap, type CreateUserFormValues } from '@/pages/users/types';
import type { useUsersMutationState } from '@/pages/users/useUsersMutationState';

const { Text } = Typography;

function renderRoleTag(roleCode: string) {
  return (
    <Tag key={roleCode} color={roleColorMap[roleCode] ?? 'default'}>
      {roleLabelMap[roleCode] ?? roleCode}
    </Tag>
  );
}

type UseUsersFormActionStateParams = {
  currentUserId: string | undefined;
  togglingUserId: string | null;
  setTogglingUserId: (value: string | null) => void;
  mutations: ReturnType<typeof useUsersMutationState>;
};

export function useUsersFormActionState({
  currentUserId,
  togglingUserId,
  setTogglingUserId,
  mutations,
}: UseUsersFormActionStateParams) {
  const { createMutation, statusMutation } = mutations;

  const columns = useMemo<ColumnsType<User>>(
    () => [
      {
        title: '用户',
        key: 'user',
        render: (_, record) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{record.display_name}</Text>
            <Text type="secondary">{record.username}</Text>
          </Space>
        ),
      },
      {
        title: '角色',
        dataIndex: 'roles',
        render: (roles: string[]) =>
          roles.length ? (
            <Space size={[0, 8]} wrap>
              {roles.map(renderRoleTag)}
            </Space>
          ) : (
            <Text type="secondary">未分配</Text>
          ),
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 120,
        render: (value: boolean) => (
          <StatusBadge
            namespace="generic"
            value={value ? 'enabled' : 'disabled'}
            label={value ? USER_ACTIVE_BADGE_LABELS.enabled : USER_ACTIVE_BADGE_LABELS.disabled}
          />
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 140,
        render: (_, record) => {
          const disabled = record.id === currentUserId;
          return (
            <Button
              size="small"
              disabled={disabled}
              loading={togglingUserId === record.id}
              onClick={(event) => {
                event.stopPropagation();
                setTogglingUserId(record.id);
                statusMutation.mutate({ userId: record.id, isActive: !record.is_active });
              }}
            >
              {disabled ? '当前账号' : record.is_active ? '停用' : '启用'}
            </Button>
          );
        },
      },
    ],
    [currentUserId, setTogglingUserId, statusMutation, togglingUserId],
  );

  const handleCreateUser = async (values: CreateUserFormValues) => {
    await createMutation.mutateAsync({
      username: values.username.trim(),
      display_name: values.display_name.trim(),
      password: values.password,
      roles: values.roles,
    });
  };

  return {
    columns,
    handleCreateUser,
    createLoading: createMutation.isPending,
  };
}
