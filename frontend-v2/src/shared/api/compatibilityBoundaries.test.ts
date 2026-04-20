import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
const TEST_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/;

const CONFIG_CENTER_ROOT = path.join(SRC_ROOT, 'shared/api/config-center');
const RETIRED_COMPATIBILITY_BARRELS = [
  path.join(SRC_ROOT, 'shared/api/tasks.ts'),
  path.join(SRC_ROOT, 'shared/api/configCenter.ts'),
] as const;
const RETIRED_ALIAS_IMPORTS = new Set([
  '@/shared/api/tasks',
  '@/shared/api/configCenter',
]);
const INTERNAL_SHARED_API_HELPER_IMPORTS = new Set([
  '@/shared/api/client',
  '@/shared/api/baseUrl',
  '@/shared/api/errors',
]);
const RETIRED_RELATIVE_IMPORTS = new Set([
  './tasks',
  './configCenter',
]);

const ALLOWED_CONFIG_CENTER_IMPORTERS = [
  'shared/api/alerts.ts',
  'shared/api/cameras.ts',
  'shared/api/dashboard.ts',
  'shared/api/modelProviders.ts',
  'shared/api/strategies.ts',
  'shared/api/training.ts',
] as const;

function collectSourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }
    return SOURCE_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

function resolveImportTarget(filePath: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) {
    return null;
  }

  const basePath = path.resolve(path.dirname(filePath), importPath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function getScriptKind(filePath: string) {
  const extension = path.extname(filePath);
  if (extension === '.tsx') {
    return ts.ScriptKind.TSX;
  }
  if (extension === '.jsx') {
    return ts.ScriptKind.JSX;
  }
  if (extension === '.js') {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function collectModuleSpecifiers(filePath: string, source: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );
  const moduleSpecifiers: string[] = [];

  function appendModuleSpecifier(node: ts.Expression | undefined) {
    if (node && ts.isStringLiteralLike(node)) {
      moduleSpecifiers.push(node.text);
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      appendModuleSpecifier(node.moduleSpecifier);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      appendModuleSpecifier(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return moduleSpecifiers;
}

function isProductionSourceFile(relativePath: string) {
  return !TEST_FILE_PATTERN.test(relativePath)
    && !relativePath.startsWith('test/')
    && !relativePath.includes('/__fixtures__/')
    && !relativePath.startsWith('__fixtures__/');
}

function collectForbiddenProductionImports() {
  const violations = new Set<string>();

  for (const filePath of collectSourceFiles(SRC_ROOT)) {
    const relativePath = path.relative(SRC_ROOT, filePath);
    if (!isProductionSourceFile(relativePath)) {
      continue;
    }

    const source = fs.readFileSync(filePath, 'utf8');
    for (const importPath of collectModuleSpecifiers(filePath, source)) {
      if (RETIRED_ALIAS_IMPORTS.has(importPath)) {
        violations.add(`${relativePath} -> ${importPath}`);
      }

      if (!relativePath.startsWith('shared/api/') && INTERNAL_SHARED_API_HELPER_IMPORTS.has(importPath)) {
        violations.add(`${relativePath} -> ${importPath}`);
      }

      if (importPath.startsWith('@/shared/api/config-center/')) {
        violations.add(`${relativePath} -> ${importPath}`);
      }

      if (relativePath.startsWith('shared/api/') && RETIRED_RELATIVE_IMPORTS.has(importPath)) {
        violations.add(`${relativePath} -> ${importPath}`);
      }
    }
  }

  return [...violations].sort();
}

function collectConfigCenterImporters() {
  const importers = new Set<string>();

  for (const filePath of collectSourceFiles(SRC_ROOT)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(SRC_ROOT, filePath);

    for (const importPath of collectModuleSpecifiers(filePath, source)) {
      const resolvedTarget = resolveImportTarget(filePath, importPath);
      if (!resolvedTarget) {
        continue;
      }

      if (path.normalize(resolvedTarget).startsWith(path.normalize(CONFIG_CENTER_ROOT))) {
        importers.add(relativePath);
      }
    }
  }

  return [...importers].sort();
}

describe('shared api compatibility boundaries', () => {
  it('retires compatibility barrels from shared/api', () => {
    expect(RETIRED_COMPATIBILITY_BARRELS.filter((filePath) => fs.existsSync(filePath))).toEqual([]);
  });

  it('keeps production source files free of retired compatibility and internal config-center imports', () => {
    expect(collectForbiddenProductionImports()).toEqual([]);
  });

  it('only allows facade entry files to import config-center internal modules', () => {
    expect(collectConfigCenterImporters()).toEqual(ALLOWED_CONFIG_CENTER_IMPORTERS);
  });

  it('ignores import-like text fixtures when scanning module boundaries', () => {
    const textOnlyFixture = 'shared/api/__fixtures__/CompatibilityTextOnly.ts';

    expect(collectConfigCenterImporters()).not.toContain(textOnlyFixture);
  });
});
