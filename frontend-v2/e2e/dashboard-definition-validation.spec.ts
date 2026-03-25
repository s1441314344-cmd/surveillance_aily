import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120000);

async function loginByUi(page: Page, username: string, password: string) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '智能巡检系统 V2' })).toBeVisible();
  await page.getByLabel('用户名').fill(username);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录系统' }).click();
}

test('invalid dashboard definition is blocked by client-side validation', async ({ page }) => {
  await loginByUi(page, 'admin', 'admin123456');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });

  await page.getByRole('menuitem', { name: '看板配置' }).click();
  await expect(page).toHaveURL(/\/dashboards$/);
  await expect(page.getByRole('heading', { name: '看板配置' })).toBeVisible();

  const dashboardName = `E2E-非法看板-${Date.now()}`;
  await page.getByLabel('看板名称').fill(dashboardName);
  await page.getByLabel('看板定义 JSON').fill(JSON.stringify({ widgets: 'invalid' }, null, 2));
  await page.getByRole('button', { name: '创建看板' }).click();

  const errorModal = page.locator('.ant-modal').filter({ hasText: '看板定义校验失败' }).first();
  await expect(errorModal).toBeVisible();
  await expect(errorModal).toContainText('widgets 必须是数组');
});

test('saved dashboard definition can pass server-side validation', async ({ page }) => {
  await loginByUi(page, 'admin', 'admin123456');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });

  await page.getByRole('menuitem', { name: '看板配置' }).click();
  await expect(page).toHaveURL(/\/dashboards$/);
  await expect(page.getByRole('heading', { name: '看板配置' })).toBeVisible();

  const dashboardName = `E2E-服务端校验看板-${Date.now()}`;
  await page.getByLabel('看板名称').fill(dashboardName);
  await page.getByLabel('看板定义 JSON').fill(
    JSON.stringify(
      {
        widgets: [{ type: 'kpi', metric: 'success_rate' }],
        filters: { time_range: '7d' },
      },
      null,
      2,
    ),
  );
  await page.getByRole('button', { name: '创建看板' }).click();
  await expect(page.getByRole('button', { name: '保存修改' })).toBeVisible();

  await page.getByRole('button', { name: '服务端校验', exact: true }).click();
  await expect(page.locator('.ant-message-notice').filter({ hasText: '看板定义服务端校验通过' })).toBeVisible();
});

test('draft dashboard definition can pass server-side validation before create', async ({ page }) => {
  await loginByUi(page, 'admin', 'admin123456');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });

  await page.getByRole('menuitem', { name: '看板配置' }).click();
  await expect(page).toHaveURL(/\/dashboards$/);
  await expect(page.getByRole('heading', { name: '看板配置' })).toBeVisible();

  const dashboardName = `E2E-草稿校验看板-${Date.now()}`;
  await page.getByRole('button', { name: '重置为新建', exact: true }).click();
  await page.getByLabel('看板名称').fill(dashboardName);
  await page.getByLabel('看板定义 JSON').fill(
    JSON.stringify(
      {
        widgets: [{ type: 'kpi', metric: 'success_rate' }],
        filters: { model_provider: 'zhipu' },
      },
      null,
      2,
    ),
  );

  await page.getByRole('button', { name: '服务端校验', exact: true }).click();
  await expect(page.locator('.ant-message-notice').filter({ hasText: '看板定义服务端校验通过' })).toBeVisible();
  await expect(page.getByRole('button', { name: '创建看板', exact: true })).toBeVisible();
});
