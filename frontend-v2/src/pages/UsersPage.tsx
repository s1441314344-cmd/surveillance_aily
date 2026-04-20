import { RoutePageHeader } from '@/shared/ui';
import { UsersAccessSection } from '@/pages/users/UsersAccessSection';
import { UsersWorkspaceSection } from '@/pages/users/UsersWorkspaceSection';
import { useUsersPageController } from '@/pages/users/useUsersPageController';

export function UsersPage() {
  const controller = useUsersPageController();

  return (
    <div className="page-stack">
      <RoutePageHeader description="管理系统用户、角色分配和启停状态，覆盖 V1 最小 RBAC 运维闭环。" />
      <UsersAccessSection canManageUsers={controller.canManageUsers} />
      <UsersWorkspaceSection controller={controller} />
    </div>
  );
}
