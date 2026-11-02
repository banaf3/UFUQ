import { expect, test } from '@playwright/test';

test('web and API health surfaces respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find True North from the stars' })).toBeVisible();

  const apiOrigin = process.env.UFUQ_E2E_API_URL ?? 'http://127.0.0.1:4174';
  const apiResponse = await request.get(`${apiOrigin}/health`);
  expect(apiResponse.ok()).toBe(true);
  await expect(apiResponse.json()).resolves.toEqual({
    status: 'ok',
    service: 'api',
    phase: 'adaptive-tutoring',
  });
});
