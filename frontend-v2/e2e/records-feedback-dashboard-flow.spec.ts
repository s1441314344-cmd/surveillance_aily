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

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
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

test('record anomaly can jump to feedback and close review loop', async ({ page, request }) => {
  const token = await loginToken(request);
  const now = new Date();
  const fileName = `e2e-loop-${Date.now()}.jpg`;

  const createJobResponse = await request.post(`${API_BASE_URL}/api/jobs/uploads`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    multipart: {
      strategy_id: 'preset-helmet',
      files: {
        name: fileName,
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-jpg-content-for-e2e-loop'),
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
  expect(processedJob.status).toBe('completed');

  const recordsResponse = await getWithRetry(request, `${API_BASE_URL}/api/task-records`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      job_id: createdJob.id,
    },
  });
  expect(recordsResponse.ok()).toBeTruthy();
  const records = (await recordsResponse.json()) as Array<{ id: string; input_filename: string }>;
  expect(records.length).toBeGreaterThanOrEqual(1);
  const targetRecordId = records[0].id;

  await loginAsAdmin(page);

  await page.goto(`/records?recordId=${targetRecordId}`);
  await expect(page.getByRole('heading', { name: '任务记录' })).toBeVisible();
  await expect(page.getByText(`记录 ID：${targetRecordId}`)).toBeVisible();
  await expect(page.getByText(`文件：${fileName}`)).toBeVisible();

  await page.goto(`/feedback?recordId=${targetRecordId}`);
  await expect(page).toHaveURL(new RegExp(`/feedback\\?recordId=${targetRecordId}`));
  await expect(page.getByRole('heading', { name: '人工复核' })).toBeVisible();
  await expect(page.getByText(`记录 ID：${targetRecordId}`)).toBeVisible();

  await page.locator('.ant-radio-button-wrapper').filter({ hasText: '错误' }).click();
  await page.getByRole('button', { name: '提交复核结果' }).click();
  await expect(page.getByText('复核结果已提交')).toBeVisible();

  await expect
    .poll(async () => {
      let anomaliesResponse;
      try {
        anomaliesResponse = await getWithRetry(request, `${API_BASE_URL}/api/dashboard/anomalies`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            strategy_id: 'preset-helmet',
            created_from: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
            created_to: new Date().toISOString(),
          },
        });
      } catch {
        return false;
      }
      if (!anomaliesResponse.ok()) {
        return false;
      }
      const anomalies = (await anomaliesResponse.json()) as Array<{ record_id: string }>;
      return anomalies.some((item) => item.record_id === targetRecordId);
    })
    .toBeTruthy();

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '总览看板' })).toBeVisible();
  await page.locator('input[type="datetime-local"]').nth(0).fill(toDateTimeLocalValue(new Date(now.getTime() - 2 * 60 * 1000)));
  await page.locator('input[type="datetime-local"]').nth(1).fill(toDateTimeLocalValue(new Date(now.getTime() + 2 * 60 * 1000)));
  const anomalyCard = page
    .locator('.ant-card')
    .filter({
      has: page.locator('.ant-card-head-title').filter({ hasText: /^异常案例$/ }),
    })
    .first();
  const anomalyRow = anomalyCard
    .locator('.ant-table-tbody tr')
    .filter({ hasText: targetRecordId.slice(0, 8) })
    .first();
  await expect(anomalyRow).toBeVisible({ timeout: 15000 });
  await anomalyRow.getByRole('button', { name: '去复核' }).click();
  await expect(page).toHaveURL(new RegExp(`/feedback\\?recordId=${targetRecordId}`));
  await expect(page.getByText(`记录 ID：${targetRecordId}`)).toBeVisible();

  await page.locator('.ant-radio-button-wrapper').filter({ hasText: '正确' }).click();
  await page.getByRole('button', { name: '更新复核结果' }).click();
  await expect(page.getByText('复核结果已更新')).toBeVisible();

  const summaryResponse = await getWithRetry(request, `${API_BASE_URL}/api/dashboard/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      strategy_id: 'preset-helmet',
      created_from: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      created_to: new Date().toISOString(),
    },
  });
  expect(summaryResponse.ok()).toBeTruthy();
  const summary = (await summaryResponse.json()) as {
    total_records: number;
    reviewed_rate: number;
    confirmed_accuracy_rate: number;
  };
  expect(summary.total_records).toBeGreaterThanOrEqual(1);
  expect(summary.reviewed_rate).toBeGreaterThan(0);
  expect(summary.confirmed_accuracy_rate).toBeGreaterThan(0);
});
