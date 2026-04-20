import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = path.resolve(process.cwd(), 'src/pages');
const PAGE_FILE_PATTERN = /Page\.tsx$/;
const UI_INDEX_FILE = path.resolve(process.cwd(), 'src/shared/ui/index.ts');

function collectPageFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectPageFiles(entryPath);
    }
    return PAGE_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

describe('page header boundaries', () => {
  it('keeps page components on RoutePageHeader instead of raw PageHeader', () => {
    const pageFiles = collectPageFiles(PAGES_ROOT);
    const violations = pageFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return source.includes('PageHeader') && !source.includes('RoutePageHeader')
        ? [path.relative(PAGES_ROOT, filePath)]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('keeps raw PageHeader out of the shared ui barrel', () => {
    const source = fs.readFileSync(UI_INDEX_FILE, 'utf8');

    expect(source).not.toContain(`export * from './PageHeader';`);
  });

  it('keeps every top-level page on the page + controller pattern', () => {
    const pageFiles = collectPageFiles(PAGES_ROOT);
    const violations = pageFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const basename = path.basename(filePath, '.tsx');
      const expectedControllerName = `use${basename}Controller`;
      return source.includes(expectedControllerName)
        ? []
        : [path.relative(PAGES_ROOT, filePath)];
    });

    expect(violations).toEqual([]);
  });

  it('keeps top-level pages free of direct orchestration hooks after controller extraction', () => {
    const pageFiles = collectPageFiles(PAGES_ROOT);
    const forbiddenTokens = [
      'useLocation',
      'useNavigate',
      'useSearchParams',
      'useMutation',
      'useQuery',
      'App.useApp',
      'useAuthStore',
      'useCameraCenterState',
      'useCameraUrlSync',
    ];
    const violations = pageFiles.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const matchedTokens = forbiddenTokens.filter((token) => source.includes(token));
      return matchedTokens.length > 0
        ? [`${path.relative(PAGES_ROOT, filePath)} -> ${matchedTokens.join(', ')}`]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
