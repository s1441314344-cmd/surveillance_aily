import { DataStateBlock, SectionCard } from '@/shared/ui';

type UsersAccessSectionProps = {
  canManageUsers: boolean;
};

export function UsersAccessSection({ canManageUsers }: UsersAccessSectionProps) {
  if (canManageUsers) {
    return null;
  }

  return (
    <SectionCard title="权限提示" subtitle="当前账号不是系统管理员">
      <DataStateBlock error="你可以访问其它模块，但用户与权限管理仅对 system_admin 开放。" />
    </SectionCard>
  );
}
