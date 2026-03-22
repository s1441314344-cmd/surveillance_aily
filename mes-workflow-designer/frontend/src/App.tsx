import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { 
  ExperimentOutlined, 
  BuildOutlined, 
  DatabaseOutlined,
  SettingOutlined
} from '@ant-design/icons';
import RecipeEditor from './apps/recipe-editor/RecipeEditor';
import InstanceGenerator from './apps/instance-generator/InstanceGenerator';
import RecipeLibrary from './apps/recipe-library/RecipeLibrary';
import './App.css';

const { Header, Sider, Content } = Layout;

// 菜单项配置
const menuItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <BuildOutlined />,
    label: <Link to="/">研发工艺编辑器</Link>,
  },
  {
    key: '/instances',
    icon: <ExperimentOutlined />,
    label: <Link to="/instances">生产工艺生成器</Link>,
  },
  {
    key: '/library',
    icon: <DatabaseOutlined />,
    label: <Link to="/library">工艺库管理</Link>,
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: <Link to="/settings">系统设置</Link>,
  },
];

// 侧边栏组件
function Sidebar() {
  const location = useLocation();
  
  return (
    <Sider width={200} style={{ background: '#fff' }}>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
      />
    </Sider>
  );
}

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
            <ExperimentOutlined style={{ marginRight: 8 }} />
            MES 工艺流程编辑器
          </div>
        </Header>
        <Layout>
          <Sidebar />
          <Layout style={{ padding: '24px' }}>
            <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280, borderRadius: 8 }}>
              <Routes>
                <Route path="/" element={<RecipeEditor />} />
                <Route path="/instances" element={<InstanceGenerator />} />
                <Route path="/library" element={<RecipeLibrary />} />
                <Route path="/settings" element={<div>系统设置</div>} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
