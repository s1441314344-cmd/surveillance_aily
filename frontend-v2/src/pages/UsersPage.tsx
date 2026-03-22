import { PagePlaceholder } from './PagePlaceholder';

export function UsersPage() {
  return (
    <PagePlaceholder
      title="用户与权限"
      description="用于管理系统用户状态和角色分配，Phase 1 只搭骨架，认证逻辑后续补全。"
      bullets={[
        '用户列表与状态切换',
        '角色分配',
        '菜单和接口级权限控制',
      ]}
      phase="Phase 1-2"
    />
  );
}
