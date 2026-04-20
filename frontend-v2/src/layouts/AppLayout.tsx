import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  AuditOutlined,
  CameraOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileSearchOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/state/authStore';
import {
  APP_NAVIGATION_ITEMS,
  type AppNavigationItem,
  getRoleLabel,
  hasAnyRole,
} from '@/shared/auth/permissions';
import { getRouteMetaByPath } from '@/shared/navigation/routeRegistry';
import { StatusBadge } from '@/shared/ui';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItemIconMap: Record<string, ReactNode> = {
  '/dashboard': <DashboardOutlined />,
  '/dashboards': <AppstoreOutlined />,
  '/strategies': <RobotOutlined />,
  '/cameras': <CameraOutlined />,
  '/alerts': <AlertOutlined />,
  '/jobs': <ScheduleOutlined />,
  '/records': <FileSearchOutlined />,
  '/feedback': <SafetyCertificateOutlined />,
  '/audit-logs': <AuditOutlined />,
  '/settings': <SettingOutlined />,
  '/local-detector': <ApiOutlined />,
  '/users': <TeamOutlined />,
};

type MenuItem = AppNavigationItem & {
  key: string;
  icon?: ReactNode;
};

const menuItems: readonly MenuItem[] = APP_NAVIGATION_ITEMS.map((item) => ({
  ...item,
  key: item.path,
  icon: menuItemIconMap[item.path],
}));

const menuGroupTitleMap = {
  overview: '总览与洞察',
  operations: '执行与巡检',
  configuration: '配置与模型',
  governance: '治理与安全',
} as const;

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [collapsed, setCollapsed] = useState(false);

  const filteredMenuItems = useMemo(
    () => menuItems.filter((item) => hasAnyRole(user?.roles, item.requiredRoles)),
    [user?.roles],
  );

  const selectedKeys = useMemo(() => {
    const matched = [...filteredMenuItems]
      .sort((left, right) => right.key.length - left.key.length)
      .find((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`));
    return matched ? [matched.key] : ['/dashboard'];
  }, [filteredMenuItems, location.pathname]);

  const activeMenuItem = useMemo(
    () => filteredMenuItems.find((item) => item.key === selectedKeys[0]) ?? filteredMenuItems[0] ?? null,
    [filteredMenuItems, selectedKeys],
  );
  const activeRouteMeta = useMemo(
    () => getRouteMetaByPath(location.pathname) ?? activeMenuItem,
    [activeMenuItem, location.pathname],
  );

  const groupedMenuItems = useMemo(
    () =>
      Object.entries(menuGroupTitleMap)
        .map(([groupKey, groupLabel]) => ({
          type: 'group' as const,
          label: groupLabel,
          key: groupKey,
          children: filteredMenuItems
            .filter((item) => item.group === groupKey)
            .map((item) => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
            })),
        }))
        .filter((group) => group.children.length > 0),
    [filteredMenuItems],
  );

  return (
    <Layout className="app-shell">
      <Sider
        theme="dark"
        width={280}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        className="app-shell__sider"
      >
        <div className="app-brand">
          <div className="app-brand__mark">SI</div>
          {!collapsed ? (
            <div className="app-brand__copy">
              <div className="app-brand__title">智能巡检系统 V2</div>
              <div className="app-brand__subtitle">独立版智能巡检平台</div>
            </div>
          ) : null}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={groupedMenuItems}
          onClick={({ key }) => navigate(key)}
          className="app-shell__menu"
        />
      </Sider>
      <Layout className="app-shell__main">
        <Header className="app-shell__header">
          <div className="app-shell__header-copy">
            <Button
              type="text"
              className="app-shell__header-toggle"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <div>
              {activeRouteMeta?.pageEyebrow ? (
                <Text className="app-shell__header-eyebrow">{activeRouteMeta.pageEyebrow}</Text>
              ) : null}
              <div className="app-shell__header-title">{activeRouteMeta?.pageTitle ?? activeRouteMeta?.label ?? '智能巡检系统'}</div>
              <Text className="app-shell__header-description">
                {activeRouteMeta?.description ?? '统一管理智能巡检任务、设备、模型与审计。'}
              </Text>
            </div>
          </div>
          <Space size={12} wrap className="app-shell__header-actions">
            <StatusBadge namespace="generic" value="active" label="系统在线" />
            <div className="app-shell__user-chip">
              <div className="app-shell__user-name">{user?.displayName ?? '开发用户'}</div>
              <div className="app-shell__user-role">{getRoleLabel(user?.roles?.[0])}</div>
            </div>
            <Button onClick={logout}>退出登录</Button>
          </Space>
        </Header>
        <Content className="app-shell__content">
          <div
            className="app-shell__content-inner"
            data-testid={activeRouteMeta?.e2eId ?? 'page-shell'}
            data-doc-slug={activeRouteMeta?.docSlug}
            data-route-module={activeRouteMeta?.module}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
