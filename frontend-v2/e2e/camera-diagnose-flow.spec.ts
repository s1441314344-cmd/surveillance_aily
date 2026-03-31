import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5800';

test.setTimeout(120000);

async function loginAsAdmin(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/login');
    await page.getByLabel('用户名').fill('admin');
    await page.getByLabel('密码').fill('admin123456');
    await page.getByRole('button', { name: '登录系统' }).click();
    try {
      await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error('admin login did not redirect to dashboard');
      }
    }
  }
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

async function seedCamera(request: APIRequestContext, token: string, cameraName: string): Promise<{ id: string; name: string }> {
  const response = await request.post(`${API_BASE_URL}/api/cameras`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: cameraName,
      location: 'E2E 诊断测试区',
      ip_address: '127.0.0.1',
      port: 554,
      protocol: 'rtsp',
      username: 'tester',
      password: 'tester123',
      rtsp_url: 'rtsp://mock/e2e-diagnose',
      frame_frequency_seconds: 30,
      resolution: '1080p',
      jpeg_quality: 80,
      storage_path: './data/storage/cameras/e2e-diagnose',
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { id: string; name: string };
  return payload;
}

test('camera diagnose action shows diagnostic modal', async ({ page, request }) => {
  const token = await loginToken(request);
  const cameraName = `E2E-Diag-${Date.now()}`;
  const camera = await seedCamera(request, token, cameraName);

  await loginAsAdmin(page);
  await page.getByRole('menuitem', { name: '摄像头中心' }).click();
  await expect(page).toHaveURL(/\/cameras(?:\/devices)?(?:\?.*)?$/);
  await expect(page.getByRole('heading', { name: '摄像头中心' })).toBeVisible();
  await page.goto(`/cameras/diagnostics?cameraId=${camera.id}`);
  await expect(page).toHaveURL(/\/cameras\/diagnostics(?:\?.*)?$/);
  await expect(page.locator('.ant-card').filter({ hasText: '状态概览' }).first()).toBeVisible();

  const diagnoseResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/cameras/${camera.id}/diagnose`) &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('cameras-diagnose-btn').click();
  const diagnoseResponse = await diagnoseResponsePromise;
  expect(diagnoseResponse.ok()).toBeTruthy();

  const diagnosticDialog = page.getByRole('dialog', { name: '摄像头诊断结果' });
  await expect(diagnosticDialog).toBeVisible();
  await expect(diagnosticDialog).toContainText(cameraName);
  await expect(diagnosticDialog).toContainText('诊断状态');
  await expect(diagnosticDialog).toContainText('成功');
  await expect(diagnosticDialog).toContainText('mock');
  await expect(page.locator('.ant-card').filter({ hasText: '状态日志' }).first()).toContainText('online');
});
