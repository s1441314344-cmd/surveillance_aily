import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteMetaByPath } from '@/shared/navigation/routeRegistry';
import { PageHeader, type PageHeaderProps } from './PageHeader';

export type RoutePageHeaderProps = Omit<PageHeaderProps, 'title'> & {
  routePath?: string;
  title?: ReactNode;
};

export function RoutePageHeader({
  routePath,
  eyebrow,
  title,
  description,
  extra,
}: RoutePageHeaderProps) {
  const location = useLocation();
  const routeMeta = getRouteMetaByPath(routePath ?? location.pathname);

  return (
    <PageHeader
      eyebrow={eyebrow ?? routeMeta?.pageEyebrow}
      title={title ?? routeMeta?.pageTitle ?? routeMeta?.label ?? '页面'}
      description={description ?? routeMeta?.description}
      extra={extra}
    />
  );
}
