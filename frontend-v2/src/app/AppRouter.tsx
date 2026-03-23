import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { useAuthStore } from '@/shared/state/authStore';

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

export function AppRouter() {
  return (
    <Suspense fallback={<RouterFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
