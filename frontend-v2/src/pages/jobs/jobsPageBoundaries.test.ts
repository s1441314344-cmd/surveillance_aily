import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const JOBS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/JobsPage.tsx');

describe('JobsPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(JOBS_PAGE_FILE, 'utf8');

    expect(source).toContain('useJobsPageController');
    expect(source).toContain('JobsMainSection');
    expect(source).toContain('JobsOverlaySection');

    expect(source).not.toContain(`from '@/pages/jobs/JobCreatePanel';`);
    expect(source).not.toContain(`from '@/pages/jobs/JobsWorkspaceTabs';`);
    expect(source).not.toContain(`from '@/pages/jobs/JobDetailDrawer';`);
    expect(source).not.toContain(`from '@/pages/jobs/ScheduleEditModal';`);
    expect(source).not.toContain('isJobDrawerOpen');
    expect(source).not.toContain('isScheduleEditorOpen');
  });
});
