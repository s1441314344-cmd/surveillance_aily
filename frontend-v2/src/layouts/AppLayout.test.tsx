import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { useAuthStore } from '@/shared/state/authStore';
import { ROLE_SYSTEM_ADMIN } from '@/shared/auth/roles';

function renderLayoutAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="dashboard" element={<div>dashboard-content</div>} />
          <Route path="cameras/media" element={<div>camera-media-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout route metadata', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'token',
      refreshToken: 'refresh',
      user: {
        id: 'user-1',
        username: 'admin',
        displayName: '系统管理员',
        roles: [ROLE_SYSTEM_ADMIN],
      },
      isAuthenticated: true,
    });
  });

  it('uses child route metadata for shell header copy and e2e id', () => {
    const { container } = renderLayoutAtPath('/cameras/media');
    const content = screen.getByTestId('page-cameras-media');

    expect(container.querySelector('.app-shell__header-eyebrow')?.textContent).toBe('设备巡检');
    expect(container.querySelector('.app-shell__header-title')?.textContent).toBe('摄像头媒体');
    expect(container.querySelector('.app-shell__header-description')?.textContent).toContain('查看抓拍素材和媒体记录');
    expect(content).toBeInTheDocument();
    expect(content).toHaveAttribute('data-doc-slug', 'cameras-media');
    expect(content).toHaveAttribute('data-route-module', 'cameras');
  });
});
