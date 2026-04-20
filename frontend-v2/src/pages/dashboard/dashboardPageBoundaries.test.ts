import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DASHBOARD_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/DashboardPage.tsx');

describe('DashboardPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(DASHBOARD_PAGE_FILE, 'utf8');

    expect(source).toContain('useDashboardPageController');
    expect(source).toContain('DashboardFiltersSection');
    expect(source).toContain('DashboardInsightsSection');
    expect(source).toContain('DashboardErrorSection');

    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain('TrendPanel');
    expect(source).not.toContain('AnomalyTable');
    expect(source).not.toContain('getApiErrorMessage');
  });
});
