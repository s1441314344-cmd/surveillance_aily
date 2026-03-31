import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:5800';

test.setTimeout(120000);

async function loginAsAdmin(page: Page) {
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
  await expect(page.getByTestId('record-detail-summary')).toContainText(`记录 ID：${targetRecordId}`);
  await expect(page.getByTestId('record-detail-summary')).toContainText(`文件：${fileName}`);

  await page.goto(`/feedback?recordId=${targetRecordId}`);
  await expect(page).toHaveURL(new RegExp(`/feedback\\?recordId=${targetRecordId}`));
  await expect(page.getByRole('heading', { name: '人工复核' })).toBeVisible();
  await expect(page.getByTestId('feedback-detail-summary')).toContainText(`记录 ID：${targetRecordId}`);

  await page.getByRole('radio', { name: '模型判断错误' }).click();
  await page.getByRole('button', { name: '提交复核' }).click();
  await expect(page.getByText('复核已提交')).toBeVisible();

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
  await page.goto(`/feedback?recordId=${targetRecordId}`);
  await expect(page).toHaveURL(new RegExp(`/feedback\\?recordId=${targetRecordId}`));
  await expect(page.getByTestId('feedback-detail-summary')).toContainText(`记录 ID：${targetRecordId}`);

  await page.getByRole('radio', { name: '模型判断正确' }).click();
  await page.getByRole('button', { name: '提交复核' }).click();
  await expect(page.getByText('复核已更新')).toBeVisible();

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
