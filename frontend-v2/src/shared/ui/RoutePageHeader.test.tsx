import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoutePageHeader } from './RoutePageHeader';

function renderRoutePageHeader(path: string, props?: Partial<ComponentProps<typeof RoutePageHeader>>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<RoutePageHeader description="页面说明" {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoutePageHeader', () => {
  it('uses route registry metadata as default eyebrow and title', () => {
    renderRoutePageHeader('/records');

    expect(screen.getByText('数据记录')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '任务记录' })).toBeInTheDocument();
    expect(screen.getByText('页面说明')).toBeInTheDocument();
  });

  it('allows explicit title and eyebrow overrides', () => {
    renderRoutePageHeader('/audit-logs', {
      eyebrow: '治理审计',
      title: '操作审计日志',
      description: '审计页说明',
    });

    expect(screen.getByText('治理审计')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '操作审计日志' })).toBeInTheDocument();
    expect(screen.getByText('审计页说明')).toBeInTheDocument();
  });

  it('supports reading metadata from an explicit route path', () => {
    renderRoutePageHeader('/cameras/media', {
      routePath: '/cameras',
      description: '摄像头页说明',
    });

    expect(screen.getByText('设备运维')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '摄像头中心' })).toBeInTheDocument();
    expect(screen.getByText('摄像头页说明')).toBeInTheDocument();
  });

  it('reads settings page eyebrow and title from route metadata', () => {
    renderRoutePageHeader('/settings', {
      description: '设置页说明',
    });

    expect(screen.getByText('模型与系统')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '模型与系统设置' })).toBeInTheDocument();
    expect(screen.getByText('设置页说明')).toBeInTheDocument();
  });

  it('reads login page eyebrow and title from route metadata', () => {
    renderRoutePageHeader('/login', {
      description: '登录页说明',
    });

    expect(screen.getByText('统一入口')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '智能巡检系统 V2' })).toBeInTheDocument();
    expect(screen.getByText('登录页说明')).toBeInTheDocument();
  });
});
