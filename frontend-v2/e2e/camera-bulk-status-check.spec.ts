import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5800';

test.setTimeout(120000);

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('admin123456');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
}

async function loginToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
    data: {
      username: 'admin',
      password: 'admin123456',
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { access_token: string };
  return payload.access_token;
}

async function seedCamera(
  request: APIRequestContext,
  token: string,
  payload: {
    name: string;
    location: string;
    rtsp_url: string;
  },
) {
  const response = await request.post(`${API_BASE_URL}/api/cameras`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: payload.name,
      location: payload.location,
      ip_address: '127.0.0.1',
      port: 554,
      protocol: 'rtsp',
      username: 'tester',
      password: 'tester123',
      rtsp_url: payload.rtsp_url,
      frame_frequency_seconds: 30,
      resolution: '1080p',
      jpeg_quality: 80,
      storage_path: './data/storage/cameras/e2e-bulk-check',
    },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: string; name: string };
}

test('bulk camera status check updates status summary and cards', async ({ page, request }) => {
  const token = await loginToken(request);
  const suffix = Date.now();
  const normalCameraName = `E2E-Bulk-OK-${suffix}`;
  const abnormalCameraName = `E2E-Bulk-BAD-${suffix}`;

  await seedCamera(request, token, {
    name: normalCameraName,
    location: 'E2E 批量巡检正常点位',
    rtsp_url: 'rtsp://mock/e2e-bulk-ok',
  });
  await seedCamera(request, token, {
    name: abnormalCameraName,
    location: 'E2E 批量巡检异常点位',
    rtsp_url: 'bad-rtsp-url',
  });

  await loginAsAdmin(page);
  await page.getByRole('menuitem', { name: '摄像头中心' }).click();
  await expect(page).toHaveURL(/\/cameras$/);
  await expect(page.getByRole('heading', { name: '摄像头中心' })).toBeVisible();

  const bulkCheckResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/cameras/check-all') && response.request().method() === 'POST',
  );
  await page.getByTestId('cameras-bulk-check-btn').click();

  const bulkCheckResponse = await bulkCheckResponsePromise;
  expect(bulkCheckResponse.ok()).toBeTruthy();
  const summary = (await bulkCheckResponse.json()) as {
    total_count: number;
    checked_count: number;
    failed_count: number;
  };
  expect(summary.total_count).toBeGreaterThanOrEqual(2);
  expect(summary.checked_count).toBeGreaterThanOrEqual(2);
  expect(summary.failed_count).toBe(0);

  const okCard = page.locator('.ant-card').filter({ hasText: normalCameraName }).first();
  await expect(okCard).toContainText('online');

  const badCard = page.locator('.ant-card').filter({ hasText: abnormalCameraName }).first();
  await expect(badCard).toContainText('offline');

  await expect(page.getByText(/在线\s+\d+\s+\/\s+告警\s+\d+/)).toBeVisible();
});
