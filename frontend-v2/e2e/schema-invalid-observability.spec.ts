import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5800';

test.setTimeout(120000);

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('admin123456');
  await page.getByRole('button', { name: '登录系统' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
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

async function getWithRetry(
  request: APIRequestContext,
  url: string,
  options: Parameters<APIRequestContext['get']>[1],
  retries = 3,
) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await request.get(url, options);
    } catch (error) {
      const isConnectionReset = String(error).includes('ECONNRESET');
      if (!isConnectionReset || attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw new Error('request retry exhausted');
}

test('schema invalid record is visible in records and dashboard metrics', async ({ page, request }) => {
  const token = await loginToken(request);
  const strategyName = `E2E-SchemaInvalid-${Date.now()}`;
  const fileName = `schema-invalid-${Date.now()}.jpg`;

  const createStrategyResponse = await request.post(`${API_BASE_URL}/api/strategies`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      name: strategyName,
      scene_description: 'E2E schema invalid observability',
      prompt_template: '请严格返回 JSON',
      model_provider: 'zhipu',
      model_name: 'glm-4v-plus',
      response_schema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            enum: ['strict-only'],
          },
        },
        required: ['summary'],
      },
      status: 'active',
    },
  });
  expect(createStrategyResponse.ok()).toBeTruthy();
  const strategy = (await createStrategyResponse.json()) as { id: string };

  const createJobResponse = await request.post(`${API_BASE_URL}/api/jobs/uploads`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    multipart: {
      strategy_id: strategy.id,
      files: {
        name: fileName,
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-jpg-content-for-schema-invalid'),
      },
    },
  });
  expect(createJobResponse.ok()).toBeTruthy();
  const createdJob = (await createJobResponse.json()) as { id: string; status: string };
  expect(createdJob.status).toBe('queued');

  const runJobResponse = await request.post(`${API_BASE_URL}/api/jobs/${createdJob.id}/run`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(runJobResponse.ok()).toBeTruthy();
  const processedJob = (await runJobResponse.json()) as { status: string };
  expect(processedJob.status).toBe('failed');

  const recordsResponse = await getWithRetry(request, `${API_BASE_URL}/api/task-records`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      job_id: createdJob.id,
    },
  });
  expect(recordsResponse.ok()).toBeTruthy();
  const records = (await recordsResponse.json()) as Array<{
    id: string;
    result_status: string;
  }>;
  expect(records.length).toBe(1);
  expect(records[0].result_status).toBe('schema_invalid');
  const targetRecordId = records[0].id;

  await expect
    .poll(async () => {
      const summaryResponse = await getWithRetry(request, `${API_BASE_URL}/api/dashboard/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          strategy_id: strategy.id,
        },
      });
      if (!summaryResponse.ok()) {
        return 0;
      }
      const summary = (await summaryResponse.json()) as {
        schema_invalid_count: number;
      };
      return summary.schema_invalid_count;
    })
    .toBe(1);

  await loginAsAdmin(page);

  await page.goto(`/records?recordId=${targetRecordId}`);
  await expect(page.getByRole('heading', { name: '任务记录' })).toBeVisible();
  await expect(page.getByText(`记录 ID：${targetRecordId}`)).toBeVisible();
  await expect(page.getByText('结果状态：schema_invalid')).toBeVisible();

  await page.goto('/dashboard');
  const filterCard = page
    .locator('.ant-card')
    .filter({
      has: page.locator('.ant-card-head-title').filter({ hasText: /^筛选条件$/ }),
    })
    .first();
  const strategyFilter = filterCard.locator('.ant-select').first();
  await strategyFilter.click();
  await page
    .locator('.ant-select-dropdown .ant-select-item-option')
    .filter({ hasText: strategyName })
    .first()
    .click();
  const schemaInvalidCard = page
    .locator('.ant-card')
    .filter({
      has: page.locator('.ant-statistic-title').filter({ hasText: /^结构化异常数$/ }),
    })
    .first();
  await expect(schemaInvalidCard.locator('.ant-statistic-content-value')).toContainText('1');
});
