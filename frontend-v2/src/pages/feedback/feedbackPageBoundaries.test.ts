import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FEEDBACK_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/FeedbackPage.tsx');

describe('FeedbackPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(FEEDBACK_PAGE_FILE, 'utf8');

    expect(source).toContain('useFeedbackPageController');
    expect(source).toContain('FeedbackFiltersSection');
    expect(source).toContain('FeedbackWorkspaceSection');

    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain(`from '@/pages/feedback/FeedbackFilters';`);
    expect(source).not.toContain(`from '@/pages/feedback/FeedbackReviewForm';`);
    expect(source).not.toContain(`from '@/pages/feedback/FeedbackDetailPanel';`);
    expect(source).not.toContain(`from '@/pages/feedback/FeedbackQueueSection';`);
  });
});
