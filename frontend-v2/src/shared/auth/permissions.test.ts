import { describe, expect, it } from 'vitest';

import {
  APP_NAVIGATION_ITEMS,
  ROLE_ANALYSIS_VIEWER,
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  getNavigationItemByPath,
  getRequiredRolesForPath,
  hasAnyRole,
} from './permissions';

describe('hasAnyRole', () => {
  it('returns true when required roles are empty', () => {
    expect(hasAnyRole([ROLE_ANALYSIS_VIEWER], [])).toBe(true);
    expect(hasAnyRole(undefined, [])).toBe(true);
    expect(hasAnyRole(undefined)).toBe(true);
  });

  it('returns false when user has no roles but route requires roles', () => {
    expect(hasAnyRole(undefined, [ROLE_SYSTEM_ADMIN])).toBe(false);
    expect(hasAnyRole([], [ROLE_SYSTEM_ADMIN])).toBe(false);
  });

  it('returns true when any required role is matched', () => {
    expect(hasAnyRole([ROLE_TASK_OPERATOR], [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR])).toBe(true);
  });

  it('returns false when user roles do not match required roles', () => {
    expect(hasAnyRole([ROLE_ANALYSIS_VIEWER], [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR])).toBe(false);
  });
});

describe('navigation role rules', () => {
  it('keeps route access and menu visibility on one shared definition', () => {
    const expectedRules: Record<string, readonly string[] | undefined> = {
      '/dashboard': undefined,
      '/dashboards': [ROLE_SYSTEM_ADMIN],
      '/strategies': [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
      '/cameras': [ROLE_SYSTEM_ADMIN],
      '/alerts': [ROLE_SYSTEM_ADMIN, ROLE_ANALYSIS_VIEWER],
      '/jobs': [ROLE_SYSTEM_ADMIN, ROLE_TASK_OPERATOR],
      '/records': undefined,
      '/feedback': [ROLE_SYSTEM_ADMIN, ROLE_MANUAL_REVIEWER],
      '/audit-logs': [ROLE_SYSTEM_ADMIN],
      '/settings': [ROLE_SYSTEM_ADMIN, ROLE_STRATEGY_CONFIGURATOR],
      '/local-detector': [ROLE_SYSTEM_ADMIN],
      '/users': [ROLE_SYSTEM_ADMIN],
    };

    for (const [path, roles] of Object.entries(expectedRules)) {
      expect(getRequiredRolesForPath(path)).toEqual(roles);
      expect(getNavigationItemByPath(path)?.requiredRoles).toEqual(roles);
    }
  });

  it('uses unique paths in shared navigation items', () => {
    const allPaths = APP_NAVIGATION_ITEMS.map((item) => item.path);
    expect(new Set(allPaths).size).toBe(allPaths.length);
  });
});
