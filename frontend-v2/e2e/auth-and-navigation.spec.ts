import { expect, test } from '@playwright/test';

test.setTimeout(120000);

test('admin can login and access key V2 pages', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '智能巡检系统 V2' })).toBeVisible();

  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('admin123456');
  await page.getByRole('button', { name: '登录系统' }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: '总览看板' })).toBeVisible();

  await page.getByRole('menuitem', { name: '策略中心' }).click();
  await expect(page).toHaveURL(/\/strategies$/);
  await expect(page.getByRole('heading', { name: '策略中心' })).toBeVisible();

  await page.getByRole('menuitem', { name: '摄像头中心' }).click();
  await expect(page).toHaveURL(/\/cameras$/);
  await expect(page.getByRole('heading', { name: '摄像头中心' })).toBeVisible();

  await page.getByRole('menuitem', { name: '任务中心' }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole('heading', { name: '任务中心' })).toBeVisible();

  await page.getByRole('menuitem', { name: '任务记录' }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole('heading', { name: '任务记录' })).toBeVisible();

  await page.getByRole('menuitem', { name: '人工复核' }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  await expect(page.getByRole('heading', { name: '人工复核' })).toBeVisible();

  await page.getByRole('menuitem', { name: '操作审计' }).click();
  await expect(page).toHaveURL(/\/audit-logs$/);
  await expect(page.getByRole('heading', { name: '操作审计日志' })).toBeVisible();

  await page.getByRole('menuitem', { name: '模型与设置' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: '模型与系统设置' })).toBeVisible();

  await page.getByRole('menuitem', { name: '用户与权限' }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('heading', { name: '用户与权限' })).toBeVisible();
});
