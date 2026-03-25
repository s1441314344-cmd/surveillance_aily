import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120000);

async function loginByUi(page: Page, username: string, password: string) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '智能巡检系统 V2' })).toBeVisible();
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录系统' }).click();
}

test('admin can create, update and delete dashboard definitions', async ({ page }) => {
  await loginByUi(page, 'admin', 'admin123456');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });

  await page.getByRole('menuitem', { name: '看板配置' }).click();
  await expect(page).toHaveURL(/\/dashboards$/);
  await expect(page.getByRole('heading', { name: '看板配置' })).toBeVisible();

  const dashboardName = `E2E看板-${Date.now()}`;
  const updatedDescription = `E2E 更新后的描述-${Date.now()}`;

  await page.getByLabel('看板名称').fill(dashboardName);
  await page.getByRole('button', { name: '创建看板' }).click();

  const listCard = page.locator('.ant-card').filter({ hasText: '看板定义列表' });
  await expect(listCard.getByText(dashboardName)).toBeVisible();
  await listCard.getByText(dashboardName).first().click();
  await expect(page.getByRole('button', { name: '保存修改' })).toBeVisible();

  await page.getByLabel('描述').fill(updatedDescription);
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(listCard.getByText(updatedDescription)).toBeVisible();

  await page.getByRole('button', { name: '删除看板' }).click();
  const confirmModal = page.locator('.ant-modal');
  await expect(confirmModal.locator('.ant-modal-confirm-title')).toBeVisible();
  await confirmModal.locator('.ant-modal-confirm-btns .ant-btn-dangerous').click();
  await expect(listCard.getByText(dashboardName)).toHaveCount(0);
});
