import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './app/AppProviders';
import { AppRouter } from './app/AppRouter';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <AppProviders>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AppProviders>
      </AntApp>
    </ConfigProvider>
  );
}
