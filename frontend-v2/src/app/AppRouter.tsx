import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { useAuthStore } from '@/shared/state/authStore';
import {
  getRequiredRolesForPath,
  hasAnyRole,
} from '@/shared/auth/permissions';

const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DashboardsPage = lazy(() =>
  import('@/pages/DashboardsPage').then((module) => ({ default: module.DashboardsPage })),
);
const StrategiesPage = lazy(() => import('@/pages/StrategiesPage').then((module) => ({ default: module.StrategiesPage })));
const CamerasPage = lazy(() => import('@/pages/CamerasPage').then((module) => ({ default: module.CamerasPage })));
const CameraDevicesPane = lazy(() =>
  import('@/pages/cameras/DevicesPane').then((module) => ({ default: module.DevicesPane })),
);
const CameraMonitoringPane = lazy(() =>
  import('@/pages/cameras/MonitoringPane').then((module) => ({ default: module.MonitoringPane })),
);
const CameraMediaPane = lazy(() =>
  import('@/pages/cameras/MediaPane').then((module) => ({ default: module.MediaPane })),
);
const CameraDiagnosticsPane = lazy(() =>
  import('@/pages/cameras/DiagnosticsPane').then((module) => ({ default: module.DiagnosticsPane })),
);
const AlertsPage = lazy(() => import('@/pages/AlertsPage').then((module) => ({ default: module.AlertsPage })));
const JobsPage = lazy(() => import('@/pages/JobsPage').then((module) => ({ default: module.JobsPage })));
const RecordsPage = lazy(() => import('@/pages/RecordsPage').then((module) => ({ default: module.RecordsPage })));
const FeedbackPage = lazy(() => import('@/pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const LocalDetectorPage = lazy(() =>
  import('@/pages/LocalDetectorPage').then((module) => ({ default: module.LocalDetectorPage })),
);
const UsersPage = lazy(() => import('@/pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const AuditLogsPage = lazy(() => import('@/pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const AccessDeniedPage = lazy(() =>
  import('@/pages/AccessDeniedPage').then((module) => ({ default: module.AccessDeniedPage })),
);

function RouterFallback() {
  return (
    <div className="app-router-fallback">
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
  const routeRoles = (path: string) => getRequiredRolesForPath(path) ?? [];

  return (
    <Suspense fallback={<RouterFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="dashboards"
            element={<RoleRoute allowedRoles={routeRoles('/dashboards')} element={<DashboardsPage />} />}
          />
          <Route
            path="strategies"
            element={
              <RoleRoute
                allowedRoles={routeRoles('/strategies')}
                element={<StrategiesPage />}
              />
            }
          />
          <Route
            path="cameras"
            element={<RoleRoute allowedRoles={routeRoles('/cameras')} element={<CamerasPage />} />}
          >
            <Route index element={<Navigate to="devices" replace />} />
            <Route path="devices" element={<CameraDevicesPane />} />
            <Route path="monitoring" element={<CameraMonitoringPane />} />
            <Route path="media" element={<CameraMediaPane />} />
            <Route path="diagnostics" element={<CameraDiagnosticsPane />} />
          </Route>
          <Route
            path="alerts"
            element={<RoleRoute allowedRoles={routeRoles('/alerts')} element={<AlertsPage />} />}
          />
          <Route
            path="jobs"
            element={
              <RoleRoute
                allowedRoles={routeRoles('/jobs')}
                element={<JobsPage />}
              />
            }
          />
          <Route
            path="records"
            element={<RoleRoute allowedRoles={routeRoles('/records')} element={<RecordsPage />} />}
          />
          <Route
            path="feedback"
            element={
              <RoleRoute
                allowedRoles={routeRoles('/feedback')}
                element={<FeedbackPage />}
              />
            }
          />
          <Route
            path="audit-logs"
            element={<RoleRoute allowedRoles={routeRoles('/audit-logs')} element={<AuditLogsPage />} />}
          />
          <Route
            path="settings"
            element={
              <RoleRoute
                allowedRoles={routeRoles('/settings')}
                element={<SettingsPage />}
              />
            }
          />
          <Route
            path="local-detector"
            element={<RoleRoute allowedRoles={routeRoles('/local-detector')} element={<LocalDetectorPage />} />}
          />
          <Route
            path="users"
            element={<RoleRoute allowedRoles={routeRoles('/users')} element={<UsersPage />} />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
