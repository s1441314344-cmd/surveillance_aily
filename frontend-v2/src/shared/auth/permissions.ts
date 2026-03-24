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

export function hasAnyRole(userRoles: string[] | undefined, requiredRoles?: readonly string[]) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  if (!userRoles || userRoles.length === 0) {
    return false;
  }
  return requiredRoles.some((role) => userRoles.includes(role));
}
