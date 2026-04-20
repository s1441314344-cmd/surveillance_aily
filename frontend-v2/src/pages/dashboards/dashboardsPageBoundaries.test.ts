import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARDS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/DashboardsPage.tsx');

describe('DashboardsPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(DASHBOARDS_PAGE_FILE, 'utf8');

    expect(source).toContain('useDashboardsPageController');
    expect(source).toContain('DashboardsHeaderActions');
    expect(source).toContain('DashboardsWorkspace');

    expect(source).not.toContain(`from 'antd'`);
    expect(source).not.toContain('DashboardDefinitionRail');
    expect(source).not.toContain('DashboardDefinitionForm');
    expect(source).not.toContain('SectionCard');
  });
});
