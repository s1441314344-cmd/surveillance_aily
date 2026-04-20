import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

const cwd = process.cwd();
const eslint = new ESLint({ cwd });

async function lintImportStatement(options: {
  filePath: string;
  importStatement: string;
  referencedSymbol: string;
}) {
  const [result] = await eslint.lintText(
    `${options.importStatement}\nvoid ${options.referencedSymbol};\n`,
    {
      filePath: options.filePath,
    },
  );

  return result.messages;
}

function hasRestrictedImport(messages: Array<{ ruleId: string | null }>) {
  return messages.some((message) => message.ruleId === 'no-restricted-imports');
}

describe('eslint compatibility import boundaries', () => {
  it.each([
    '@/shared/api/tasks',
    '@/shared/api/configCenter',
  ])('rejects production imports from %s', async (importPath) => {
    const messages = await lintImportStatement({
      importStatement: `import { sample } from '${importPath}';`,
      referencedSymbol: 'sample',
      filePath: path.join(cwd, 'src/pages/__fixtures__/CompatibilityProbe.tsx'),
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    '@/shared/api/tasks',
    '@/shared/api/configCenter',
  ])('rejects shared/api production imports from %s', async (importPath) => {
    const messages = await lintImportStatement({
      importStatement: `import { sample } from '${importPath}';`,
      referencedSymbol: 'sample',
      filePath: path.join(cwd, 'src/shared/api/__fixtures__/CompatibilityProbe.ts'),
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    path.join(cwd, 'src/pages/__fixtures__/CompatibilityProbe.tsx'),
    path.join(cwd, 'src/shared/api/__fixtures__/CompatibilityProbe.ts'),
  ])('rejects production imports from internal config-center modules: %s', async (filePath) => {
    const messages = await lintImportStatement({
      importStatement: `import { sample } from '@/shared/api/config-center/settings';`,
      referencedSymbol: 'sample',
      filePath,
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    {
      filePath: path.join(cwd, 'src/app/__fixtures__/TransportBoundaryProbe.ts'),
      importPath: '@/shared/api/client',
      referencedSymbol: 'apiClient',
    },
    {
      filePath: path.join(cwd, 'src/app/__fixtures__/TransportBoundaryProbe.ts'),
      importPath: '@/shared/api/baseUrl',
      referencedSymbol: 'resolveBaseUrl',
    },
    {
      filePath: path.join(cwd, 'src/pages/__fixtures__/TransportBoundaryProbe.tsx'),
      importPath: '@/shared/api/client',
      referencedSymbol: 'apiClient',
    },
    {
      filePath: path.join(cwd, 'src/pages/__fixtures__/TransportBoundaryProbe.tsx'),
      importPath: '@/shared/api/baseUrl',
      referencedSymbol: 'resolveBaseUrl',
    },
  ])('rejects transport helper imports outside shared/api: %s in %s', async ({ filePath, importPath, referencedSymbol }) => {
    const messages = await lintImportStatement({
      importStatement: `import { ${referencedSymbol} } from '${importPath}';`,
      referencedSymbol,
      filePath,
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    path.join(cwd, 'src/app/__fixtures__/ApiErrorMessageProbe.ts'),
    path.join(cwd, 'src/pages/__fixtures__/ApiErrorMessageProbe.tsx'),
  ])('rejects page-level imports from shared/api/errors after helper migration: %s', async (filePath) => {
    const messages = await lintImportStatement({
      importStatement: `import { getApiErrorMessage } from '@/shared/api/errors';`,
      referencedSymbol: 'getApiErrorMessage',
      filePath,
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    './tasks',
    './configCenter',
  ])('rejects relative compatibility barrel imports in shared api production modules: %s', async (importPath) => {
    const messages = await lintImportStatement({
      importStatement: `import { sample } from '${importPath}';`,
      referencedSymbol: 'sample',
      filePath: path.join(cwd, 'src/shared/api/__fixtures__/CompatibilityProbe.ts'),
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    {
      filePath: path.join(cwd, 'src/shared/api/tasks.test.ts'),
      importStatement: `import * as tasksBarrel from './tasks';`,
      referencedSymbol: 'tasksBarrel',
    },
    {
      filePath: path.join(cwd, 'src/shared/api/configCenter.test.ts'),
      importStatement: `import * as configCenterBarrel from './configCenter';`,
      referencedSymbol: 'configCenterBarrel',
    },
  ])('rejects retired compatibility barrel imports even in former self-test paths: %s', async ({ filePath, importStatement, referencedSymbol }) => {
    const messages = await lintImportStatement({
      importStatement,
      referencedSymbol,
      filePath,
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    `import { PageHeader } from '@/shared/ui';`,
    `import { PageHeader } from '@/shared/ui/PageHeader';`,
  ])('rejects raw PageHeader imports in page modules: %s', async (importStatement) => {
    const messages = await lintImportStatement({
      importStatement,
      referencedSymbol: 'PageHeader',
      filePath: path.join(cwd, 'src/pages/__fixtures__/PageHeaderBoundaryProbe.tsx'),
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });

  it.each([
    {
      importStatement: `import { useNavigate } from 'react-router-dom';`,
      referencedSymbol: 'useNavigate',
    },
    {
      importStatement: `import { useLocation } from 'react-router-dom';`,
      referencedSymbol: 'useLocation',
    },
    {
      importStatement: `import { useSearchParams } from 'react-router-dom';`,
      referencedSymbol: 'useSearchParams',
    },
    {
      importStatement: `import { useMutation } from '@tanstack/react-query';`,
      referencedSymbol: 'useMutation',
    },
    {
      importStatement: `import { useQuery } from '@tanstack/react-query';`,
      referencedSymbol: 'useQuery',
    },
    {
      importStatement: `import { useAuthStore } from '@/shared/state/authStore';`,
      referencedSymbol: 'useAuthStore',
    },
    {
      importStatement: `import { useCameraCenterState } from '@/pages/cameras/useCameraCenterState';`,
      referencedSymbol: 'useCameraCenterState',
    },
    {
      importStatement: `import { useCameraUrlSync } from '@/pages/cameras/useCameraUrlSync';`,
      referencedSymbol: 'useCameraUrlSync',
    },
  ])('rejects direct page orchestration imports in top-level page modules: %s', async ({ importStatement, referencedSymbol }) => {
    const messages = await lintImportStatement({
      importStatement,
      referencedSymbol,
      filePath: path.join(cwd, 'src/pages/TopLevelPageBoundaryProbePage.tsx'),
    });

    expect(hasRestrictedImport(messages)).toBe(true);
  });
});
