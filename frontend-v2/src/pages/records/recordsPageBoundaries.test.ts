import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RECORDS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/RecordsPage.tsx');

describe('RecordsPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(RECORDS_PAGE_FILE, 'utf8');

    expect(source).toContain('useRecordsPageController');
    expect(source).toContain('RecordsFiltersSection');
    expect(source).toContain('RecordsWorkspaceSection');

    expect(source).not.toContain(`from '@/pages/records/RecordsFilters';`);
    expect(source).not.toContain(`from '@/pages/records/RecordsListSection';`);
    expect(source).not.toContain(`from '@/pages/records/RecordDetailSection';`);
    expect(source).not.toContain('page-grid--master-detail');
  });
});
