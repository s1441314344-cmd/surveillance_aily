import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = path.resolve(process.cwd(), 'src/shared/api');
const IGNORED_FILES = new Set([
  'baseUrl.ts',
  'client.ts',
]);
const RETIRED_COMPATIBILITY_FILES = [
  'configCenter.ts',
  'tasks.ts',
] as const;

function collectTopLevelApiFiles() {
  return fs.readdirSync(API_ROOT)
    .filter((entry) => entry.endsWith('.ts'))
    .filter((entry) => !entry.endsWith('.test.ts'))
    .filter((entry) => !IGNORED_FILES.has(entry))
    .sort();
}

describe('shared api traceability annotations', () => {
  it('requires every top-level api entry file to declare @prd traceability', () => {
    const files = collectTopLevelApiFiles();
    const violations = files.flatMap((fileName) => {
      const source = fs.readFileSync(path.join(API_ROOT, fileName), 'utf8');
      return /^\/\/ @prd /m.test(source) ? [] : [`${fileName} -> missing @prd`];
    });

    expect(violations).toEqual([]);
  });

  it('retires compatibility barrel files from shared/api top-level entries', () => {
    const files = collectTopLevelApiFiles();
    expect(files).not.toEqual(expect.arrayContaining([...RETIRED_COMPATIBILITY_FILES]));
  });
});
