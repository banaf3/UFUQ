// Sky explorer, the first page (report UC-102): the whole sky by default, layer toggles,
// projections and navigation. CI has no review preview, so the strict real sky fails
// closed and the page falls back to the visibly synthetic fixture.
import { expect, test, type Page } from '@playwright/test';

const SYNTHETIC = 'synthetic-technical|SYNTHETIC_TECHNICAL_FIXTURE';

async function openExplorer(page: Page) {
  await page.goto('/');
  await expect(page.locator('.sky-notice summary')).toContainText('stars', { timeout: 20_000 });
}

test('opens on the sky, not on a scenario form, and falls back safely', async ({ page }) => {
  await openExplorer(page);
  await expect(page.getByLabel('Data')).toHaveValue(SYNTHETIC);
  await expect(page.locator('.badge')).toContainText('Synthetic fixture');
  await expect(page.locator('.sky-notice')).toContainText('NOT_SCIENTIFICALLY_APPROVED');
  await expect(page.locator('.sky-notice summary')).toContainText('413 stars');
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('toggles figure lines and names from the bottom-left buttons', async ({ page }) => {
  await openExplorer(page);
  const lines = page.getByRole('button', { name: 'Lines' });
  const names = page.getByRole('button', { name: 'Names' });
  await expect(lines).toHaveAttribute('aria-pressed', 'true');
  await lines.click();
  await expect(lines).toHaveAttribute('aria-pressed', 'false');
  await names.click();
  await expect(names).toHaveAttribute('aria-pressed', 'false');
  await names.click();
  await expect(names).toHaveAttribute('aria-pressed', 'true');
});

test('navigates with the mouse, zoom buttons and projections', async ({ page }) => {
  await openExplorer(page);
  const readout = page.locator('.readout');
  await expect(readout).toContainText('Az 0°');
  const stage = page.locator('.sky-stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('no sky');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 250, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(readout).not.toContainText('Az 0°');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(readout).toContainText('FOV 88°');
  await page.getByLabel('Projection').selectOption('FISHEYE');
  await expect(page.getByLabel('Projection')).toHaveValue('FISHEYE');
});

test('finds a named star and shows its card; shows a custom instant', async ({ page }) => {
  await openExplorer(page);
  await page.getByPlaceholder('Find a star or figure').fill('Synthetica');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Selected star' })).toContainText(
    'Synthetica',
  );
  await page.getByLabel('Scenario').selectOption('__custom__');
  await page.getByRole('textbox', { name: 'Date and time (UTC)' }).fill('2026-06-01T15:00');
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(page.locator('.sky-notice summary')).toContainText('2026-06-01T15:00:00Z');
  await expect(page.getByRole('button', { name: 'Start lesson' })).toBeDisabled();
});
