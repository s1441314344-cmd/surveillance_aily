export {
  ROLE_ANALYSIS_VIEWER,
  ROLE_LABEL_MAP,
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  getRoleLabel,
  type RoleCode,
} from './roles';

export {
  APP_NAVIGATION_ITEMS,
  APP_ROUTE_REGISTRY,
  getNavigationItemByPath,
  getRequiredRolesForPath,
  getRouteModuleByPath,
  type AppNavigationGroup,
  type AppNavigationItem,
  type AppRouteModule,
} from '@/shared/navigation/routeRegistry';

export function hasAnyRole(userRoles: string[] | undefined, requiredRoles?: readonly string[]) {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }
  if (!userRoles || userRoles.length === 0) {
    return false;
  }
  return requiredRoles.some((role) => userRoles.includes(role));
}
