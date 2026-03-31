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
        throw new Error(`login failed for user ${username}`);
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

test('dashboard preset filters can be applied from selected dashboard definition', async ({ page, request }) => {
  const token = await loginToken(request);
  const strategyName = `E2E-预设策略-${Date.now()}`;
  const dashboardName = `E2E-预设看板-${Date.now()}`;

  const createStrategyResponse = await request.post(`${API_BASE_URL}/api/strategies`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: strategyName,
      scene_description: 'E2E dashboard preset filter strategy',
      prompt_template: '请严格返回 JSON',
      model_provider: 'zhipu',
      model_name: 'glm-4v-plus',
      response_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
        },
        required: ['summary'],
      },
      status: 'active',
    },
  });
  expect(createStrategyResponse.ok()).toBeTruthy();
  const strategy = (await createStrategyResponse.json()) as { id: string };

  const createDashboardResponse = await request.post(`${API_BASE_URL}/api/dashboards`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: dashboardName,
      description: 'E2E dashboard preset filter',
      definition: {
        widgets: [
          { type: 'line', metric: 'jobs_trend' },
          { type: 'table', metric: 'anomalies' },
        ],
        filters: {
          strategy_id: strategy.id,
          model_provider: 'zhipu',
          anomaly_type: 'schema_invalid',
          time_range: '7d',
        },
      },
      status: 'active',
      is_default: false,
    },
  });
  expect(createDashboardResponse.ok()).toBeTruthy();

  await loginByUi(page, 'admin', 'admin123456');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: '总览看板' })).toBeVisible();

  const dashboardSelect = page.getByTestId('dashboard-filter-dashboard');
  const strategySelect = page.getByTestId('dashboard-filter-strategy');
  const providerSelect = page.getByTestId('dashboard-filter-provider');
  const anomalyTypeSelect = page.getByTestId('dashboard-filter-anomaly');

  await dashboardSelect.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: dashboardName })
    .first()
    .click();

  await page.getByTestId('dashboard-apply-preset').click();

  await expect(strategySelect).toContainText(strategyName);
  await expect(providerSelect).toContainText('智谱');
  await expect(anomalyTypeSelect).toContainText('结构化异常');
});
