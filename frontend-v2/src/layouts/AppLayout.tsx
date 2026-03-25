import {
  AppstoreOutlined,
  AuditOutlined,
  CameraOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/shared/state/authStore';
import {
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  hasAnyRole,
} from '@/shared/auth/permissions';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems: Array<{
  key: string;
  icon: ReactNode;
  label: string;
  requiredRoles?: readonly string[];
}> = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览看板' },
  { key: '/dashboards', icon: <AppstoreOutlined />, label: '看板配置', requiredRoles: [ROLE_SYSTEM_ADMIN] },
  {
    key: '/strategies',
    icon: <RobotOutlined />,
    label: '策略中心',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
  },
  {
    key: '/cameras',
    icon: <CameraOutlined />,
    label: '摄像头中心',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    key: '/jobs',
    icon: <ScheduleOutlined />,
    label: '任务中心',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR],
  },
  { key: '/records', icon: <FileSearchOutlined />, label: '任务记录' },
  {
    key: '/feedback',
    icon: <SafetyCertificateOutlined />,
    label: '人工复核',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER],
  },
  { key: '/audit-logs', icon: <AuditOutlined />, label: '操作审计', requiredRoles: [ROLE_SYSTEM_ADMIN] },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '模型与设置',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
  },
  { key: '/users', icon: <TeamOutlined />, label: '用户与权限', requiredRoles: [ROLE_SYSTEM_ADMIN] },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const filteredMenuItems = useMemo(
    () => menuItems.filter((item) => hasAnyRole(user?.roles, item.requiredRoles)),
    [user?.roles],
  );
  const renderedMenuItems = useMemo(
    () =>
      filteredMenuItems.map((item) => {
        const nextItem = { ...item };
        delete nextItem.requiredRoles;
        return nextItem;
      }),
    [filteredMenuItems],
  );

  const selectedKeys = useMemo(() => {
    const matched = [...filteredMenuItems]
      .sort((left, right) => right.key.length - left.key.length)
      .find((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`));
    return matched ? [matched.key] : ['/dashboard'];
  }, [filteredMenuItems, location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={240} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 20 }}>
          <Title level={4} style={{ margin: 0 }}>
            智能巡检系统 V2
          </Title>
          <Text type="secondary">Phase 1 工程骨架</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          items={renderedMenuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingInline: 24,
          }}
        >
          <Space orientation="vertical" size={0}>
            <Text strong>V2 平台骨架</Text>
            <Text type="secondary">当前阶段：Backlog 拆分后初始化工程</Text>
          </Space>
          <Space>
            <Text>{user?.displayName ?? '开发用户'}</Text>
            <Button onClick={logout}>退出</Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
