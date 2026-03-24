import { describe, expect, it } from 'vitest';

import {
  ROLE_ANALYSIS_VIEWER,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
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
