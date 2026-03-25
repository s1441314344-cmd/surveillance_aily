import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

test.setTimeout(120000);

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('admin123456');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
}

test('upload job is queued and can be cancelled in job center', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();

  const createTaskCard = page.locator('.ant-card').filter({ hasText: '创建任务' }).first();
  const strategySelect = createTaskCard
    .locator('.ant-form-item')
    .filter({ hasText: '分析策略' })
    .locator('.ant-select')
    .first();
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
  await jobRow.click();

  const detailCard = page.locator('.ant-card-small').filter({ hasText: '任务详情' }).first();
  await expect(detailCard).toBeVisible();
  await expect(detailCard.getByText('queued')).toBeVisible();

  await detailCard.getByRole('button', { name: '取消任务' }).click();
  await expect(page.getByText('任务状态已更新')).toBeVisible();
  await expect(detailCard.getByText('cancelled')).toBeVisible();
});
