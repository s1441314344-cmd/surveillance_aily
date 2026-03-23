import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('admin123456');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('upload job is queued and can be cancelled in job center', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();

  const strategySelect = page.locator('.ant-form-item').filter({ hasText: '分析策略' }).locator('.ant-select');
  await strategySelect.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const uploadInput = page.locator('input[type="file"]');
  const sampleImagePath = fileURLToPath(new URL('../../test_media/test_cam_1.jpg', import.meta.url));
  await uploadInput.setInputFiles(sampleImagePath);

  await page.getByRole('button', { name: '提交上传任务' }).click();
  await expect(page.getByText('上传任务已进入队列')).toBeVisible();

  const detailCard = page.locator('.ant-card-small').filter({ hasText: '任务详情' }).first();
  await expect(detailCard).toBeVisible();
  await expect(detailCard.getByText('queued')).toBeVisible();

  await detailCard.getByRole('button', { name: '取消任务' }).click();
  await expect(page.getByText('任务状态已更新')).toBeVisible();
  await expect(detailCard.getByText('cancelled')).toBeVisible();
});
