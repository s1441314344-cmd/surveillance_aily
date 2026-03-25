import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5800';

test.setTimeout(120000);

async function loginAsAdmin(page: Page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/login');
    await page.getByLabel('用户名').fill('admin');
    await page.getByLabel('密码').fill('admin123456');
    await page.getByRole('button', { name: '登录系统' }).click();
    try {
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
      await page.waitForTimeout(500);
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

async function seedCamera(request: APIRequestContext, token: string, cameraName: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/cameras`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: cameraName,
      location: 'E2E 测试区域',
      ip_address: '127.0.0.1',
      port: 554,
      protocol: 'rtsp',
      username: 'tester',
      password: 'tester123',
      rtsp_url: 'rtsp://mock/e2e-schedule',
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

async function seedSchedule(request: APIRequestContext, token: string, cameraId: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/job-schedules`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      camera_id: cameraId,
      strategy_id: 'preset-helmet',
      schedule_type: 'interval_minutes',
      schedule_value: '5',
    },
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { id: string };
  return payload.id;
}

test('schedule can be paused/resumed and linked to queue filters', async ({ page, request }) => {
  const token = await loginToken(request);
  const cameraName = `E2E-Cam-${Date.now()}`;
  const cameraId = await seedCamera(request, token, cameraName);
  const scheduleId = await seedSchedule(request, token, cameraId);
  const shortScheduleId = scheduleId.slice(0, 8);

  await loginAsAdmin(page);
  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();

  const scheduleCard = page.locator('.ant-card').filter({ hasText: '定时任务计划' }).first();
  const scheduleCameraFilter = scheduleCard.locator('.ant-card-extra .ant-select').nth(1);
  const visibleSelectOptions = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
  );
  await scheduleCameraFilter.click();
  await visibleSelectOptions.filter({ hasText: cameraName }).first().click();

  const schedulesRefetchPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/job-schedules') &&
      response.url().includes(`camera_id=${cameraId}`) &&
      response.request().method() === 'GET',
  );
  await schedulesRefetchPromise;

  const scheduleRow = scheduleCard.locator('.ant-table-tbody tr').filter({ hasText: shortScheduleId }).first();
  await expect(scheduleRow).toBeVisible({ timeout: 30000 });
  await expect(scheduleRow).toContainText('active');
  await expect(scheduleRow).toContainText('5 分钟');

  await scheduleRow.getByRole('button', { name: /暂\s*停/ }).click();
  await expect(scheduleRow).toContainText('paused');

  await scheduleRow.getByRole('button', { name: /启\s*用/ }).click();
  await expect(scheduleRow).toContainText('active');

  const runNowResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/job-schedules/${scheduleId}/run-now`) &&
      response.request().method() === 'POST',
  );
  await scheduleRow.getByRole('button', { name: '立即执行' }).click();
  const runNowResponse = await runNowResponsePromise;
  expect(runNowResponse.ok()).toBeTruthy();
  const runNowJob = (await runNowResponse.json()) as { id: string };

  await scheduleRow.getByRole('button', { name: '查看任务' }).click();

  const taskQueueCard = page.locator('.ant-card').filter({ hasText: '任务队列' }).first();
  await expect(taskQueueCard.locator('[data-testid="jobs-filter-trigger"]')).toContainText('定时触发');
  await expect(taskQueueCard.locator('[data-testid="jobs-filter-schedule"]')).toContainText(shortScheduleId);
  await expect(taskQueueCard.locator('.ant-table-tbody tr').filter({ hasText: runNowJob.id.slice(0, 8) }).first()).toBeVisible();
});
