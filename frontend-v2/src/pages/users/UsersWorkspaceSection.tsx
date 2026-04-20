import { UserCreateForm } from '@/pages/users/UserCreateForm';
import { UsersListSection } from '@/pages/users/UsersListSection';
import { UserStatsOverview } from '@/pages/users/UserStatsOverview';
import type { useUsersPageController } from '@/pages/users/useUsersPageController';

type UsersPageController = ReturnType<typeof useUsersPageController>;

type UsersWorkspaceSectionProps = {
  controller: UsersPageController;
};

export function UsersWorkspaceSection({ controller }: UsersWorkspaceSectionProps) {
  if (!controller.canManageUsers) {
    return null;
  }

  return (
    <>
      <UserStatsOverview stats={controller.queries.userStats} />

      <div className="page-grid page-grid--master-detail">
        <UsersListSection
          users={controller.queries.users}
          loading={controller.queries.usersQuery.isLoading}
          error={controller.queries.usersError}
          selectedUserId={controller.selectedUserId}
          columns={controller.actions.columns}
          onSelectUser={controller.setSelectedUserId}
        />

        <UserCreateForm
          form={controller.form}
          loading={controller.actions.createLoading}
          onSubmit={controller.actions.handleCreateUser}
        />
      </div>
    </>
  );
}
