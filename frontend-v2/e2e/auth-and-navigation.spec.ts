import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5800';

test.setTimeout(120000);

async function loginByUi(page: Page, username: string, password: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '智能巡检系统 V2' })).toBeVisible();
    await page.getByLabel('用户名').fill(username);
    await page.getByLabel('密码').fill(password);
    await page.getByRole('button', { name: '登录系统' }).click();
    try {
      await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
      return;
    } catch {
      if (attempt === 2) {
        break;
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

async function seedAnalysisViewerUser(
  request: APIRequestContext,
  token: string,
  payload: { username: string; password: string; displayName: string },
) {
  const response = await request.post(`${API_BASE_URL}/api/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      username: payload.username,
      password: payload.password,
      display_name: payload.displayName,
      roles: ['analysis_viewer'],
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function navigateByMenu(
  page: Page,
  menuName: string,
  urlPattern: RegExp,
  headingName: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole('menuitem', { name: menuName }).click();
    try {
      await expect(page).toHaveURL(urlPattern, { timeout: 10000 });
      await expect(page.getByRole('heading', { name: headingName })).toBeVisible();
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }
}

test('admin can login and access key V2 pages', async ({ page }) => {
  await loginByUi(page, 'admin', 'admin123456');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: '总览看板' })).toBeVisible();

  await navigateByMenu(page, '策略中心', /\/strategies$/, '策略中心');
  await navigateByMenu(page, '摄像头中心', /\/cameras(?:\/devices)?(?:\?.*)?$/, '摄像头中心');
  await navigateByMenu(page, '任务中心', /\/jobs$/, '任务中心');
  await navigateByMenu(page, '任务记录', /\/records$/, '任务记录');
  await navigateByMenu(page, '人工复核', /\/feedback$/, '人工复核');
  await navigateByMenu(page, '操作审计', /\/audit-logs$/, '操作审计日志');
  await navigateByMenu(page, '模型与设置', /\/settings$/, '模型与系统设置');
  await navigateByMenu(page, '看板配置', /\/dashboards$/, '看板配置');
  await navigateByMenu(page, '用户与权限', /\/users$/, '用户与权限');
});

test('analysis viewer can only access viewer pages and is blocked on restricted routes', async ({ page, request }) => {
  const adminToken = await loginToken(request);
  const viewerUsername = `viewer_${Date.now()}`;
  const viewerPassword = 'viewer123456';
  await seedAnalysisViewerUser(request, adminToken, {
    username: viewerUsername,
    password: viewerPassword,
    displayName: 'E2E 分析查看者',
  });

  await loginByUi(page, viewerUsername, viewerPassword);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: '总览看板' })).toBeVisible();

  await expect(page.getByRole('menuitem', { name: '任务记录' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '策略中心' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '摄像头中心' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '任务中心' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '人工复核' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '操作审计' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '模型与设置' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '看板配置' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '用户与权限' })).toHaveCount(0);

  await page.goto('/records');
  await expect(page.getByRole('heading', { name: '任务记录' })).toBeVisible();

  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: '无权限访问' })).toBeVisible();
  await page.getByRole('button', { name: '返回总览看板' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
