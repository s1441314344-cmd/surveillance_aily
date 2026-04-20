import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ALERTS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/AlertsPage.tsx');

describe('AlertsPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(ALERTS_PAGE_FILE, 'utf8');

    expect(source).toContain('useAlertsPageController');
    expect(source).toContain('AlertsHeaderSummary');
    expect(source).toContain('AlertsTabsWorkspace');
    expect(source).toContain('AlertsEditModals');

    expect(source).not.toContain(`from 'antd'`);
    expect(source).not.toContain('<Tabs');
    expect(source).not.toContain('AlertWebhookEditModal');
    expect(source).not.toContain('AlertNotificationRouteEditModal');
  });
});
