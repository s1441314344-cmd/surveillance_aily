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
  ROLE_ANALYSIS_VIEWER,
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  getRoleLabel,
  hasAnyRole,
} from '@/shared/auth/permissions';
import { StatusBadge } from '@/shared/ui';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems: Array<{
  key: string;
  icon: ReactNode;
  label: string;
  description: string;
  group: 'overview' | 'operations' | 'configuration' | 'governance';
  requiredRoles?: readonly string[];
}> = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '总览看板',
    description: '监控全局指标、趋势和异常案例。',
    group: 'overview',
  },
  {
    key: '/dashboards',
    icon: <AppstoreOutlined />,
    label: '看板配置',
    description: '维护可复用看板定义和展示规则。',
    group: 'overview',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    key: '/strategies',
    icon: <RobotOutlined />,
    label: '策略中心',
    description: '管理巡检策略、模型与输出约束。',
    group: 'configuration',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
  },
  {
    key: '/cameras',
    icon: <CameraOutlined />,
    label: '摄像头中心',
    description: '维护设备、监测规则、媒体与诊断。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    key: '/alerts',
    icon: <AlertOutlined />,
    label: '告警中心',
    description: '查看告警事件并管理 Webhook 分发。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_ANALYSIS_VIEWER],
  },
  {
    key: '/jobs',
    icon: <ScheduleOutlined />,
    label: '任务中心',
    description: '创建任务、跟踪队列与定时计划。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR],
  },
  {
    key: '/records',
    icon: <FileSearchOutlined />,
    label: '任务记录',
    description: '查询执行记录、原图与结构化结果。',
    group: 'operations',
  },
  {
    key: '/feedback',
    icon: <SafetyCertificateOutlined />,
    label: '人工复核',
    description: '复核模型结论并沉淀反馈样本。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER],
  },
  {
    key: '/audit-logs',
    icon: <AuditOutlined />,
    label: '操作审计',
    description: '查看后台操作与异常行为轨迹。',
    group: 'governance',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '模型与设置',
    description: '维护模型提供方并执行联调调试。',
    group: 'configuration',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
  },
  {
    key: '/local-detector',
    icon: <ApiOutlined />,
    label: '本地检测',
    description: '查看本地检测服务状态并执行单图门控调试。',
    group: 'configuration',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    key: '/users',
    icon: <TeamOutlined />,
    label: '用户与权限',
    description: '管理用户状态、角色与系统治理。',
    group: 'governance',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
];

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
              <div className="app-shell__header-title">{activeMenuItem?.label ?? '智能巡检系统'}</div>
              <Text className="app-shell__header-description">
                {activeMenuItem?.description ?? '统一管理智能巡检任务、设备、模型与审计。'}
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
          <div className="app-shell__content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
