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

async function seedCamera(request: APIRequestContext, token: string, cameraName: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/cameras`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: cameraName,
      location: 'E2E 单次任务测试区',
      ip_address: '127.0.0.1',
      port: 554,
      protocol: 'rtsp',
      username: 'tester',
      password: 'tester123',
      rtsp_url: 'rtsp://mock/e2e-camera-once',
      frame_frequency_seconds: 30,
      resolution: '1080p',
      jpeg_quality: 80,
      storage_path: './data/storage/cameras/e2e',
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { id: string };
  return payload.id;
}

test('camera once job is queued and can be cancelled in job center', async ({ page, request }) => {
  const token = await loginToken(request);
  const cameraName = `E2E-OnceCam-${Date.now()}`;
  await seedCamera(request, token, cameraName);

  await loginAsAdmin(page);
  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();

  const createTaskCard = page.locator('.ant-card').filter({ hasText: '创建任务' }).first();
  const taskModeSelect = createTaskCard.locator('.ant-form-item').filter({ hasText: '任务类型' }).locator('.ant-select');
  await taskModeSelect.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: '摄像头单次抽帧' })
    .first()
    .click();

  const cameraSelect = createTaskCard.locator('.ant-form-item').filter({ hasText: '选择摄像头' }).locator('.ant-select');
  await cameraSelect.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: cameraName })
    .first()
    .click();

  const createJobResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/jobs/cameras/once') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '执行摄像头单次任务' }).click();
  const createJobResponse = await createJobResponsePromise;
  expect(createJobResponse.ok()).toBeTruthy();
  const createdJob = (await createJobResponse.json()) as { id: string };

  const jobRow = page
    .locator('.ant-table-tbody tr')
    .filter({ hasText: createdJob.id.slice(0, 8) })
    .first();
  await expect(jobRow).toBeVisible();
  await jobRow.click();

  const detailCard = page.locator('.ant-card-small').filter({ hasText: '任务详情' }).first();
  await expect(detailCard).toBeVisible();
  await expect(detailCard).toContainText('camera_once');
  await expect(detailCard).toContainText('queued');

  await detailCard.getByRole('button', { name: '取消任务' }).click();
  await expect(detailCard).toContainText('cancelled');
});
