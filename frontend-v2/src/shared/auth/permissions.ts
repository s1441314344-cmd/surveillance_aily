export const ROLE_SYSTEM_ADMIN = 'system_admin';
export const ROLE_STRATEGY_CONFIGURATOR = 'strategy_configurator';
export const ROLE_TASK_OPERATOR = 'task_operator';
export const ROLE_MANUAL_REVIEWER = 'manual_reviewer';
export const ROLE_ANALYSIS_VIEWER = 'analysis_viewer';

export type RoleCode =
  | typeof ROLE_SYSTEM_ADMIN
  | typeof ROLE_STRATEGY_CONFIGURATOR
  | typeof ROLE_TASK_OPERATOR
  | typeof ROLE_MANUAL_REVIEWER
  | typeof ROLE_ANALYSIS_VIEWER;

export const ROLE_LABEL_MAP: Record<RoleCode, string> = {
  [ROLE_SYSTEM_ADMIN]: '系统管理员',
  [ROLE_STRATEGY_CONFIGURATOR]: '策略配置员',
  [ROLE_TASK_OPERATOR]: '任务操作员',
  [ROLE_MANUAL_REVIEWER]: '人工复核员',
  [ROLE_ANALYSIS_VIEWER]: '分析查看者',
};

export type AppNavigationGroup = 'overview' | 'operations' | 'configuration' | 'governance';

export type AppNavigationItem = {
  path: string;
  label: string;
  description: string;
  group: AppNavigationGroup;
  requiredRoles?: readonly RoleCode[];
};

export const APP_NAVIGATION_ITEMS: readonly AppNavigationItem[] = [
  {
    path: '/dashboard',
    label: '总览看板',
    description: '监控全局指标、趋势和异常案例。',
    group: 'overview',
  },
  {
    path: '/dashboards',
    label: '看板配置',
    description: '维护可复用看板定义和展示规则。',
    group: 'overview',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/strategies',
    label: '策略中心',
    description: '管理巡检策略、模型与输出约束。',
    group: 'configuration',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
  },
  {
    path: '/cameras',
    label: '摄像头中心',
    description: '维护设备、监测规则、媒体与诊断。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/alerts',
    label: '告警中心',
    description: '查看告警事件并管理 Webhook 分发。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_ANALYSIS_VIEWER],
  },
  {
    path: '/jobs',
    label: '任务中心',
    description: '创建任务、跟踪队列与定时计划。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR],
  },
  {
    path: '/records',
    label: '任务记录',
    description: '查询执行记录、原图与结构化结果。',
    group: 'operations',
  },
  {
    path: '/feedback',
    label: '人工复核',
    description: '复核模型结论并沉淀反馈样本。',
    group: 'operations',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER],
  },
  {
    path: '/audit-logs',
    label: '操作审计',
    description: '查看后台操作与异常行为轨迹。',
    group: 'governance',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/settings',
    label: '模型与设置',
    description: '维护模型提供方并执行联调调试。',
    group: 'configuration',
    requiredRoles: [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
  },
  {
    path: '/local-detector',
    label: '本地检测',
    description: '查看本地检测服务状态并执行单图门控调试。',
    group: 'configuration',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
  {
    path: '/users',
    label: '用户与权限',
    description: '管理用户状态、角色与系统治理。',
    group: 'governance',
    requiredRoles: [ROLE_SYSTEM_ADMIN],
  },
] as const;

const APP_NAVIGATION_ITEM_MAP = new Map(APP_NAVIGATION_ITEMS.map((item) => [item.path, item] as const));

function normalizeAppPath(path: string): string {
  if (!path) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function getNavigationItemByPath(path: string): AppNavigationItem | undefined {
  return APP_NAVIGATION_ITEM_MAP.get(normalizeAppPath(path));
}

export function getRequiredRolesForPath(path: string): readonly string[] | undefined {
  return getNavigationItemByPath(path)?.requiredRoles;
}

export function getRoleLabel(roleCode: string | undefined): string {
  if (!roleCode) {
    return '未分配角色';
  }
  return ROLE_LABEL_MAP[roleCode as RoleCode] ?? roleCode;
}

export function hasAnyRole(userRoles: string[] | undefined, requiredRoles?: readonly string[]) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  if (!userRoles || userRoles.length === 0) {
    return false;
  }
  return requiredRoles.some((role) => userRoles.includes(role));
}
