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

export function getRoleLabel(roleCode: string | undefined): string {
  if (!roleCode) {
    return '未分配角色';
  }
  return ROLE_LABEL_MAP[roleCode as RoleCode] ?? roleCode;
}
