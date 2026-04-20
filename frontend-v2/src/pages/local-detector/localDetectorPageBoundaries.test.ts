import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCAL_DETECTOR_PAGE_FILE = path.resolve(process.cwd(), 'src/pages/LocalDetectorPage.tsx');

describe('LocalDetectorPage boundaries', () => {
  it('keeps the top-level page focused on section composition', () => {
    const source = fs.readFileSync(LOCAL_DETECTOR_PAGE_FILE, 'utf8');

    expect(source).toContain('useLocalDetectorPageController');
    expect(source).toContain('LocalDetectorHealthSection');
    expect(source).toContain('LocalDetectorConfigSection');
    expect(source).toContain('LocalDetectorDebugSection');
    expect(source).toContain('LocalDetectorResultSection');
    expect(source).toContain('LocalDetectorHistorySection');

    expect(source).not.toContain(`from 'antd'`);
    expect(source).not.toContain(`from '@ant-design/icons'`);
    expect(source).not.toContain('DataStateBlock');
    expect(source).not.toContain('SectionCard');
    expect(source).not.toContain('getLocalDetectorErrorMessage');
  });
});
