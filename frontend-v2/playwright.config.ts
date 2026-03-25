import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5280',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'cd ../backend-v2 && rm -f ./data/e2e.db && APP_ENV=test DATABASE_URL=sqlite:///./data/e2e.db CELERY_ENABLED=false CORS_ORIGINS=http://127.0.0.1:5280,http://localhost:5280 python3 -m uvicorn app.main:app --host 127.0.0.1 --port 5800',
      url: 'http://127.0.0.1:5800/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'VITE_API_BASE_URL=http://127.0.0.1:5800 npm run dev -- --host 127.0.0.1 --port 5280 --strictPort',
      url: 'http://127.0.0.1:5280/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
