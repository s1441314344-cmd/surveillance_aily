import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SETTINGS_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/SettingsPage.tsx');

describe('SettingsPage boundaries', () => {
  it('keeps the top-level page focused on section composition', () => {
    const source = fs.readFileSync(SETTINGS_PAGE_FILE, 'utf8');

    expect(source).toContain('useSettingsPageController');
    expect(source).toContain('SettingsHeaderActions');
    expect(source).toContain('SettingsProviderWorkspace');
    expect(source).toContain('SettingsIntroSection');

    expect(source).not.toContain(`from 'antd'`);
    expect(source).not.toContain('DataStateBlock');
    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain('ProviderSelectionRail');
    expect(source).not.toContain('TrainingFeedbackPanel');
  });
});
