import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { useAuthStore } from '@/shared/state/authStore';
import {
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  hasAnyRole,
} from '@/shared/auth/permissions';

const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const StrategiesPage = lazy(() => import('@/pages/StrategiesPage').then((module) => ({ default: module.StrategiesPage })));
const CamerasPage = lazy(() => import('@/pages/CamerasPage').then((module) => ({ default: module.CamerasPage })));
const JobsPage = lazy(() => import('@/pages/JobsPage').then((module) => ({ default: module.JobsPage })));
const RecordsPage = lazy(() => import('@/pages/RecordsPage').then((module) => ({ default: module.RecordsPage })));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazy(() => import('@/pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const AuditLogsPage = lazy(() => import('@/pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const AccessDeniedPage = lazy(() =>
  import('@/pages/AccessDeniedPage').then((module) => ({ default: module.AccessDeniedPage })),
);

function RouterFallback() {
  return (
    <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
      <Spin size="large" />
    </div>
  );
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />;
}

function RoleRoute({
  allowedRoles,
  element,
}: {
  allowedRoles: readonly string[];
  element: ReactNode;
}) {
  const userRoles = useAuthStore((state) => state.user?.roles);
  return hasAnyRole(userRoles, allowedRoles) ? <>{element}</> : <AccessDeniedPage />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouterFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="strategies"
            element={
              <RoleRoute
                allowedRoles={[ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR]}
                element={<StrategiesPage />}
              />
            }
          />
          <Route
            path="cameras"
            element={<RoleRoute allowedRoles={[ROLE_SYSTEM_ADMIN]} element={<CamerasPage />} />}
          />
          <Route
            path="jobs"
            element={
              <RoleRoute
                allowedRoles={[ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR]}
                element={<JobsPage />}
              />
            }
          />
          <Route path="records" element={<RecordsPage />} />
          <Route
            path="feedback"
            element={
              <RoleRoute
                allowedRoles={[ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER]}
                element={<FeedbackPage />}
              />
            }
          />
          <Route
            path="audit-logs"
            element={<RoleRoute allowedRoles={[ROLE_SYSTEM_ADMIN]} element={<AuditLogsPage />} />}
          />
          <Route
            path="settings"
            element={
              <RoleRoute
                allowedRoles={[ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR]}
                element={<SettingsPage />}
              />
            }
          />
          <Route
            path="users"
            element={<RoleRoute allowedRoles={[ROLE_SYSTEM_ADMIN]} element={<UsersPage />} />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
