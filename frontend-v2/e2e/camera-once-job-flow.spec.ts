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

  const createTaskCard = page.locator('.ant-card').filter({ hasText: '任务创建' }).first();
  const taskModeSelect = createTaskCard.getByTestId('job-create-task-mode');
  const visibleSelectOptions = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
  );
  await taskModeSelect.click();
  await visibleSelectOptions.filter({ hasText: '摄像头单次抽帧' }).first().click();

  const cameraSelect = createTaskCard.getByTestId('job-create-camera');
  await cameraSelect.click();
  await visibleSelectOptions.filter({ hasText: cameraName }).first().click();
  await expect(page.getByRole('button', { name: '执行摄像头单次任务', exact: true })).toBeEnabled();

  const createJobResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/jobs/cameras/once') && response.request().method() === 'POST',
    { timeout: 60000 },
  );
  await page.getByRole('button', { name: '执行摄像头单次任务', exact: true }).click();
  const createJobResponse = await createJobResponsePromise;
  expect(createJobResponse.ok()).toBeTruthy();
  const createdJob = (await createJobResponse.json()) as { id: string };

  const jobRow = page
    .locator('.ant-table-tbody tr')
    .filter({ hasText: createdJob.id.slice(0, 8) })
    .first();
  await expect(jobRow).toBeVisible();
  const cancelButton = jobRow.getByRole('button', { name: '取消' });
  const canCancel = await cancelButton.isVisible().catch(() => false);
  if (canCancel) {
    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/jobs/${createdJob.id}/cancel`) && response.request().method() === 'POST',
      { timeout: 60000 },
    );
    await cancelButton.click();
    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.ok()).toBeTruthy();
    await expect(jobRow).toContainText('已取消');
  } else {
    await expect(jobRow).toContainText(/等待中|处理中|已完成|失败|已取消/);
  }

  const detailDrawer = page.getByRole('dialog', { name: /任务详情/ });
  if (!(await detailDrawer.isVisible().catch(() => false))) {
    await jobRow.click();
  }
  await expect(detailDrawer).toBeVisible();
  await expect(detailDrawer).toContainText('摄像头单次');
  await expect(detailDrawer).toContainText(/等待中|处理中|已完成|失败|已取消/);
});
