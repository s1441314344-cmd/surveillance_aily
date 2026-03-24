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

async function seedOnvifCamera(request: APIRequestContext, token: string, cameraName: string) {
  const response = await request.post(`${API_BASE_URL}/api/cameras`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: cameraName,
      location: 'E2E ONVIF 防护测试区',
      ip_address: '127.0.0.1',
      port: 80,
      protocol: 'onvif',
      username: 'tester',
      password: 'tester123',
      rtsp_url: 'rtsp://mock/e2e-onvif',
      frame_frequency_seconds: 30,
      resolution: '1080p',
      jpeg_quality: 80,
      storage_path: './data/storage/cameras/e2e-onvif',
    },
  });
  expect(response.ok()).toBeTruthy();
}

test('camera once form blocks non-rtsp camera selection in v1 flow', async ({ page, request }) => {
  const token = await loginToken(request);
  const cameraName = `E2E-ONVIF-${Date.now()}`;
  await seedOnvifCamera(request, token, cameraName);

  await loginAsAdmin(page);
  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);

  const createTaskCard = page.locator('.ant-card').filter({ hasText: '创建任务' }).first();

  const taskModeSelect = createTaskCard.locator('.ant-form-item').filter({ hasText: '任务类型' }).locator('.ant-select');
  await taskModeSelect.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: '摄像头单次抽帧' })
    .first()
    .click();

  const strategySelect = createTaskCard.locator('.ant-form-item').filter({ hasText: '分析策略' }).locator('.ant-select');
  await strategySelect.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: '火情识别' })
    .first()
    .click();

  const cameraSelect = createTaskCard.locator('.ant-form-item').filter({ hasText: '选择摄像头' }).locator('.ant-select');
  await cameraSelect.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: cameraName })
    .first()
    .click();

  await expect(createTaskCard.getByText('当前摄像头协议暂不支持')).toBeVisible();
  await expect(createTaskCard.getByRole('button', { name: '执行摄像头单次任务' })).toBeDisabled();
});
