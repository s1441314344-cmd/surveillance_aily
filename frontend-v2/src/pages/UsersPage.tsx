import {
  DataStateBlock,
  PageHeader,
  SectionCard,
} from '@/shared/ui';
import { UserCreateForm } from '@/pages/users/UserCreateForm';
import { UsersListSection } from '@/pages/users/UsersListSection';
import { UserStatsOverview } from '@/pages/users/UserStatsOverview';
import { useUsersPageController } from '@/pages/users/useUsersPageController';

export function UsersPage() {
  const {
    form,
    canManageUsers,
    selectedUserId,
    setSelectedUserId,
    queries,
    actions,
  } = useUsersPageController();

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="权限治理"
        title="用户与权限"
        description="管理系统用户、角色分配和启停状态，覆盖 V1 最小 RBAC 运维闭环。"
      />

      {!canManageUsers ? (
        <SectionCard title="权限提示" subtitle="当前账号不是系统管理员">
          <DataStateBlock error="你可以访问其它模块，但用户与权限管理仅对 system_admin 开放。" />
        </SectionCard>
      ) : (
        <>
          <UserStatsOverview stats={queries.userStats} />

          <div className="page-grid page-grid--master-detail">
            <UsersListSection
              users={queries.users}
              loading={queries.usersQuery.isLoading}
              error={queries.usersError}
              selectedUserId={selectedUserId}
              columns={actions.columns}
              onSelectUser={setSelectedUserId}
            />

            <UserCreateForm form={form} loading={actions.createLoading} onSubmit={actions.handleCreateUser} />
          </div>
        </>
      )}
    </div>
  );
}
