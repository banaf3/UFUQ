import { expect, test } from '@playwright/test';

test('web and API health surfaces respond', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find True North from the stars' })).toBeVisible();

  const apiResponse = await request.get('http://127.0.0.1:4174/health');
  expect(apiResponse.ok()).toBe(true);
  await expect(apiResponse.json()).resolves.toEqual({
    status: 'ok',
    service: 'api',
    phase: 'vertical-slice',
  });
});
