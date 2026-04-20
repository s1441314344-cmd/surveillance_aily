import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const STRATEGIES_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/StrategiesPage.tsx');

describe('StrategiesPage boundaries', () => {
  it('keeps the top-level page focused on composition', () => {
    const source = fs.readFileSync(STRATEGIES_PAGE_FILE, 'utf8');

    expect(source).toContain('useStrategiesPageController');
    expect(source).toContain('StrategiesHeaderActions');
    expect(source).toContain('StrategiesWorkspaceSection');

    expect(source).not.toContain(`from 'antd'`);
    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain('StrategySelectionRail');
    expect(source).not.toContain('StrategyEditorForm');
    expect(source).not.toContain('StatusBadge');
  });
});
