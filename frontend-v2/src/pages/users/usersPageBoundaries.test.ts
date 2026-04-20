import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const USERS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/UsersPage.tsx');

describe('UsersPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(USERS_PAGE_FILE, 'utf8');

    expect(source).toContain('useUsersPageController');
    expect(source).toContain('UsersAccessSection');
    expect(source).toContain('UsersWorkspaceSection');

    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain('DataStateBlock');
    expect(source).not.toContain('UserStatsOverview');
    expect(source).not.toContain('UsersListSection');
    expect(source).not.toContain('UserCreateForm');
  });
});
