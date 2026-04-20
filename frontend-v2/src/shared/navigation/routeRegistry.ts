import {
  ROLE_ANALYSIS_VIEWER,
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  type RoleCode,
} from '@/shared/auth/roles';

export type AppNavigationGroup = 'overview' | 'operations' | 'configuration' | 'governance';
export type AppRouteModule =
  | 'auth'
  | 'dashboard'
  | 'dashboards'
  | 'strategies'
  | 'cameras'
  | 'alerts'
  | 'jobs'
  | 'records'
  | 'feedback'
  | 'audit-logs'
  | 'settings'
  | 'local-detector'
  | 'users';

export type AppRouteMeta = {
  path: string;
  module: AppRouteModule;
  label: string;
  description: string;
  docSlug: string;
  e2eId: string;
  pageTitle?: string;
  pageEyebrow?: string;
  requiredRoles?: readonly RoleCode[];
  group?: AppNavigationGroup;
};

export type AppNavigationItem = AppRouteMeta & {
  group: AppNavigationGroup;
};

export const APP_ROUTE_REGISTRY: readonly AppRouteMeta[] = [
  {
    path: '/login',
    module: 'auth',
    label: '登录',
    description: '用户登录与会话建立入口。',
    docSlug: 'auth-login',
    e2eId: 'page-login',
    pageTitle: '智能巡检系统 V2',
    pageEyebrow: '统一入口',
  },
  {
    path: '/dashboard',
    module: 'dashboard',
    label: '总览看板',
    description: '监控全局指标、趋势和异常案例。',
    docSlug: 'dashboard-overview',
    e2eId: 'page-dashboard',
    pageTitle: '总览看板',
    pageEyebrow: '数据概览',
    group: 'overview',
  },
  {
    path: '/dashboards',
    module: 'dashboards',
    label: '看板配置',
    description: '维护可复用看板定义和展示规则。',
    docSlug: 'dashboards-config',
    e2eId: 'page-dashboards',
    pageTitle: '看板配置',
    pageEyebrow: '看板治理',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
    group: 'overview',
  },
  {
    path: '/strategies',
    module: 'strategies',
    label: '策略中心',
    description: '管理巡检策略、模型与输出约束。',
    docSlug: 'strategies-center',
    e2eId: 'page-strategies',
    pageTitle: '策略中心',
    pageEyebrow: '策略配置',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
    group: 'configuration',
  },
  {
    path: '/cameras',
    module: 'cameras',
    label: '摄像头中心',
    description: '维护设备、监测规则、媒体与诊断。',
    docSlug: 'cameras-索引',
    e2eId: 'page-cameras',
    pageTitle: '摄像头中心',
    pageEyebrow: '设备运维',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
    group: 'operations',
  },
  {
    path: '/cameras/devices',
    module: 'cameras',
    label: '摄像头设备',
    description: '维护摄像头设备信息和连接状态。',
    docSlug: 'cameras-devices',
    e2eId: 'page-cameras-devices',
    pageTitle: '摄像头设备',
    pageEyebrow: '设备巡检',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/cameras/monitoring',
    module: 'cameras',
    label: '摄像头监测',
    description: '配置监测规则并执行调试。',
    docSlug: 'cameras-monitoring',
    e2eId: 'page-cameras-monitoring',
    pageTitle: '摄像头监测',
    pageEyebrow: '设备巡检',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/cameras/media',
    module: 'cameras',
    label: '摄像头媒体',
    description: '查看抓拍素材和媒体记录。',
    docSlug: 'cameras-media',
    e2eId: 'page-cameras-media',
    pageTitle: '摄像头媒体',
    pageEyebrow: '设备巡检',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/cameras/diagnostics',
    module: 'cameras',
    label: '摄像头诊断',
    description: '查看设备诊断与状态日志。',
    docSlug: 'cameras-diagnostics',
    e2eId: 'page-cameras-diagnostics',
    pageTitle: '摄像头诊断',
    pageEyebrow: '设备巡检',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/alerts',
    module: 'alerts',
    label: '告警中心',
    description: '查看告警事件并管理 Webhook 分发。',
    docSlug: 'alerts-center',
    e2eId: 'page-alerts',
    pageTitle: '告警中心',
    pageEyebrow: '告警协同',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_ANALYSIS_VIEWER],
    group: 'operations',
  },
  {
    path: '/jobs',
    module: 'jobs',
    label: '任务中心',
    description: '创建任务、跟踪队列与定时计划。',
    docSlug: 'jobs-center',
    e2eId: 'page-jobs',
    pageTitle: '任务中心',
    pageEyebrow: '任务执行',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR],
    group: 'operations',
  },
  {
    path: '/records',
    module: 'records',
    label: '任务记录',
    description: '查询执行记录、原图与结构化结果。',
    docSlug: 'records-center',
    e2eId: 'page-records',
    pageTitle: '任务记录',
    pageEyebrow: '数据记录',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR, ROLE_MANUAL_REVIEWER, ROLE_ANALYSIS_VIEWER],
    group: 'operations',
  },
  {
    path: '/feedback',
    module: 'feedback',
    label: '人工复核',
    description: '复核模型结论并沉淀反馈样本。',
    docSlug: 'feedback-center',
    e2eId: 'page-feedback',
    pageTitle: '人工复核',
    pageEyebrow: '结果复核',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER],
    group: 'operations',
  },
  {
    path: '/audit-logs',
    module: 'audit-logs',
    label: '操作审计',
    description: '查看后台操作与异常行为轨迹。',
    docSlug: 'audit-logs',
    e2eId: 'page-audit-logs',
    pageTitle: '操作审计日志',
    pageEyebrow: '治理审计',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
    group: 'governance',
  },
  {
    path: '/settings',
    module: 'settings',
    label: '模型与系统设置',
    description: '维护模型提供方并执行联调调试。',
    docSlug: 'settings-model-system',
    e2eId: 'page-settings',
    pageTitle: '模型与系统设置',
    pageEyebrow: '模型与系统',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
    group: 'configuration',
  },
  {
    path: '/local-detector',
    module: 'local-detector',
    label: '本地检测',
    description: '查看本地检测服务状态并执行单图门控调试。',
    docSlug: 'local-detector',
    e2eId: 'page-local-detector',
    pageTitle: '本地检测',
    pageEyebrow: '本地算法服务',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
    group: 'configuration',
  },
  {
    path: '/users',
    module: 'users',
    label: '用户与权限',
    description: '管理用户状态、角色与系统治理。',
    docSlug: 'users-and-permissions',
    e2eId: 'page-users',
    pageTitle: '用户与权限',
    pageEyebrow: '权限治理',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
    group: 'governance',
  },
] as const;

const APP_ROUTE_META_MAP = new Map(APP_ROUTE_REGISTRY.map((item) => [item.path, item] as const));

function normalizeAppPath(path: string): string {
  if (!path) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function isNavigationItem(item: AppRouteMeta): item is AppNavigationItem {
  return typeof item.group === 'string';
}

export const APP_NAVIGATION_ITEMS: readonly AppNavigationItem[] = APP_ROUTE_REGISTRY.filter(isNavigationItem);

export function getRouteMetaByPath(path: string): AppRouteMeta | undefined {
  return APP_ROUTE_META_MAP.get(normalizeAppPath(path));
}

export function getNavigationItemByPath(path: string): AppNavigationItem | undefined {
  const routeMeta = getRouteMetaByPath(path);
  return routeMeta && isNavigationItem(routeMeta) ? routeMeta : undefined;
}

export function getRequiredRolesForPath(path: string): readonly RoleCode[] | undefined {
  return getRouteMetaByPath(path)?.requiredRoles;
}

export function getRouteModuleByPath(path: string): AppRouteModule | undefined {
  return getRouteMetaByPath(path)?.module;
}
