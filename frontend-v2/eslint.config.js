import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const compatibilityRestrictedImports = [
  {
    name: '@/shared/api/tasks',
    message: '生产代码请直接从 jobs、records、feedback 领域 API 导入。',
  },
  {
    name: '@/shared/api/configCenter',
    message: '生产代码请直接从对应领域 API 或 config-center 子域入口导入。',
  },
];

const internalConfigCenterRestrictedPatterns = [
  {
    group: ['@/shared/api/config-center/*'],
    message: '生产代码请通过 shared/api 顶层领域入口导入，不要直接依赖内部 config-center 子域模块。',
  },
];

const internalSharedApiHelperRestrictedImports = [
  {
    name: '@/shared/api/client',
    message: 'apiClient 属于 shared/api 内部传输层实现，生产代码请通过领域 API 入口发起请求。',
  },
  {
    name: '@/shared/api/baseUrl',
    message: 'resolveBaseUrl 属于 shared/api 内部初始化细节，生产代码不要直接依赖。',
  },
  {
    name: '@/shared/api/errors',
    message: 'getApiErrorMessage 已迁到 shared/utils/apiErrorMessage，生产代码不要再从 shared/api/errors 导入。',
  },
];

const compatibilityRelativeBarrelRestrictedImports = [
  {
    name: './tasks',
    message: 'shared/api 内部请直接从 jobs、records、feedback 领域 API 导入，不要重新绕回 compatibility barrel。',
  },
  {
    name: './configCenter',
    message: 'shared/api 内部请直接从正式领域 API 导入，不要重新绕回 configCenter compatibility barrel。',
  },
];

const pageHeaderRestrictedImports = [
  {
    name: '@/shared/ui',
    importNames: ['PageHeader'],
    message: '页面模块请使用 RoutePageHeader，不要从 shared/ui 直接导入 PageHeader。',
  },
  {
    name: '@/shared/ui/PageHeader',
    message: '页面模块请使用 RoutePageHeader，不要直接引用原始 PageHeader 组件。',
  },
];

const topLevelPageOrchestrationRestrictedImports = [
  {
    name: 'react-router-dom',
    importNames: ['useLocation', 'useNavigate', 'useSearchParams'],
    message: '顶层页面请通过对应的 use*PageController 处理路由与查询参数编排，不要在 Page 组件里直接绑定路由 orchestration hook。',
  },
  {
    name: '@tanstack/react-query',
    importNames: ['useMutation', 'useQuery'],
    message: '顶层页面请通过对应的 use*PageController 处理 query/mutation，不要在 Page 组件里直接绑定 react-query hook。',
  },
  {
    name: '@/shared/state/authStore',
    importNames: ['useAuthStore'],
    message: '顶层页面请通过对应的 use*PageController 处理 auth store 读取，不要直接在 Page 组件里绑定 useAuthStore。',
  },
  {
    name: '@/pages/cameras/useCameraCenterState',
    importNames: ['useCameraCenterState'],
    message: 'CamerasPage 请通过 useCamerasPageController 统一编排 camera center state。',
  },
  {
    name: '@/pages/cameras/useCameraUrlSync',
    importNames: ['useCameraUrlSync'],
    message: 'CamerasPage 请通过 useCamerasPageController 统一编排 URL sync。',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'test-results', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**/*'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [...compatibilityRestrictedImports, ...internalSharedApiHelperRestrictedImports],
        patterns: internalConfigCenterRestrictedPatterns,
      }],
    },
  },
  {
    files: ['src/shared/api/**/*.{ts,tsx}'],
    ignores: ['src/test/**/*'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [...compatibilityRestrictedImports, ...compatibilityRelativeBarrelRestrictedImports],
        patterns: internalConfigCenterRestrictedPatterns,
      }],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**/*'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          ...compatibilityRestrictedImports,
          ...internalSharedApiHelperRestrictedImports,
          ...pageHeaderRestrictedImports,
        ],
        patterns: internalConfigCenterRestrictedPatterns,
      }],
    },
  },
  {
    files: ['src/pages/*Page.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: topLevelPageOrchestrationRestrictedImports,
      }],
    },
  },
);
