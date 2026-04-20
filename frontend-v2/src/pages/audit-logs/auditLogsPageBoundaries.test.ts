import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const AUDIT_LOGS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/AuditLogsPage.tsx');

describe('AuditLogsPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(AUDIT_LOGS_PAGE_FILE, 'utf8');

    expect(source).toContain('useAuditLogsPageController');
    expect(source).toContain('AuditLogsAccessSection');
    expect(source).toContain('AuditLogsWorkspaceSection');

    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain('DataStateBlock');
    expect(source).not.toContain('Table<AuditLog>');
    expect(source).not.toContain('AuditLogFilters');
  });
});
