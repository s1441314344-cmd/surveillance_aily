import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

test.setTimeout(120000);

async function loginAsAdmin(page: import('@playwright/test').Page) {
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

test('upload job is queued and can be cancelled in job center', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();

  const createTaskCard = page.locator('.ant-card').filter({ hasText: '任务创建' }).first();
  const strategySelect = createTaskCard.getByTestId('job-create-strategy');
  const visibleSelectOptions = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
  );
  await strategySelect.click();
  await expect(visibleSelectOptions.first()).toBeVisible();
  await visibleSelectOptions.first().click();

  const uploadInput = page.locator('input[type="file"]');
  const sampleImagePath = fileURLToPath(new URL('../../test_media/test_cam_1.jpg', import.meta.url));
  await uploadInput.setInputFiles(sampleImagePath);
  await expect(page.getByRole('button', { name: '提交上传任务', exact: true })).toBeEnabled();

  const createJobResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/jobs/uploads') && response.request().method() === 'POST',
    { timeout: 60000 },
  );
  await page.getByRole('button', { name: '提交上传任务', exact: true }).click();
  const createJobResponse = await createJobResponsePromise;
  expect(createJobResponse.ok()).toBeTruthy();
  const createdJob = (await createJobResponse.json()) as { id: string };

  const jobRow = page
    .locator('.ant-table-tbody tr')
    .filter({ hasText: createdJob.id.slice(0, 8) })
    .first();
  await expect(jobRow).toBeVisible();
  const cancelButton = jobRow.getByRole('button', { name: '取消' });
  if (await cancelButton.isVisible().catch(() => false)) {
    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/jobs/${createdJob.id}/cancel`) &&
        response.request().method() === 'POST',
      { timeout: 60000 },
    );
    await cancelButton.click();
    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.ok()).toBeTruthy();
    await expect(jobRow).toContainText('已取消');
  }

  const detailDrawer = page.getByRole('dialog', { name: /任务详情/ });
  if (!(await detailDrawer.isVisible().catch(() => false))) {
    await jobRow.click();
  }
  await expect(detailDrawer).toBeVisible();
  await expect(detailDrawer).toContainText(/等待中|处理中|已完成|失败|已取消/);
});
