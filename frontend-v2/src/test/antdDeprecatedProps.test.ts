import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(import.meta.dirname, '..');

function collectTsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      return collectTsxFiles(absolutePath);
    }
    return absolutePath.endsWith('.tsx') ? [absolutePath] : [];
  });
}

function findDeprecatedUsage(pattern: RegExp): string[] {
  return collectTsxFiles(SRC_DIR)
    .filter((filePath) => pattern.test(readFileSync(filePath, 'utf-8')))
    .map((filePath) => relative(SRC_DIR, filePath))
    .sort();
}

describe('antd deprecated props', () => {
  it('does not use deprecated Space.direction', () => {
    expect(findDeprecatedUsage(/<Space\b[^>]*\bdirection=/g)).toEqual([]);
  });

  it('does not use deprecated Alert.message', () => {
    expect(findDeprecatedUsage(/<Alert\b[^>]*\bmessage=/g)).toEqual([]);
  });

  it('does not use deprecated Drawer.width', () => {
    expect(findDeprecatedUsage(/<Drawer\b[^>]*\bwidth=/g)).toEqual([]);
  });
});
