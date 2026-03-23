import {
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
import { useAuthStore } from '@/shared/state/authStore';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '总览看板' },
  { key: '/strategies', icon: <RobotOutlined />, label: '策略中心' },
  { key: '/cameras', icon: <CameraOutlined />, label: '摄像头中心' },
  { key: '/jobs', icon: <ScheduleOutlined />, label: '任务中心' },
  { key: '/records', icon: <FileSearchOutlined />, label: '任务记录' },
  { key: '/feedback', icon: <SafetyCertificateOutlined />, label: '人工复核' },
  { key: '/audit-logs', icon: <AuditOutlined />, label: '操作审计' },
  { key: '/settings', icon: <SettingOutlined />, label: '模型与设置' },
  { key: '/users', icon: <TeamOutlined />, label: '用户与权限' },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const canViewAuditLogs = user?.roles.includes('system_admin') ?? false;

  const filteredMenuItems = useMemo(
    () => menuItems.filter((item) => (item.key === '/audit-logs' ? canViewAuditLogs : true)),
    [canViewAuditLogs],
  );

  const selectedKeys = useMemo(() => {
    const matched = filteredMenuItems.find((item) => location.pathname.startsWith(item.key));
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
          items={filteredMenuItems}
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
