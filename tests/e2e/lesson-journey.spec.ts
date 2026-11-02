// Phase 2 browser evidence on the visibly synthetic technical fixture: a complete
// three-step journey using only keyboard/accessible controls, with the server deciding
// route, targets and correctness.
import { expect, test, type Page } from '@playwright/test';

async function startSyntheticLesson(page: Page, scenarioLabel: RegExp) {
  await page.goto('/');
  await page
    .getByLabel('Dataset')
    .selectOption({ label: 'Synthetic technical fixture (not the real sky)' });
  await page
    .getByLabel('Scenario')
    .selectOption({ label: scenarioLabel.source.replace(/\\/g, '') });
  await page.getByRole('button', { name: 'Start lesson' }).click();
}

function starButtons(page: Page) {
  return page.getByRole('list').locator('button');
}

/** Reads the accessible star list and returns altitudes keyed by button index. */
async function altitudes(page: Page): Promise<number[]> {
  const labels = await starButtons(page).evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label') ?? ''),
  );
  return labels.map((label) => Number(/altitude (-?\d+) degrees/.exec(label)?.[1] ?? 'NaN'));
}

test('synthetic lesson: helper pattern, target star, then True North', async ({ page }) => {
  await startSyntheticLesson(page, /Synthetic scenario A \(route A\)/);
  await expect(page.getByRole('heading', { name: 'Synthetic route A' })).toBeVisible();
  await expect(page.getByRole('note').first()).toContainText('SYNTHETIC TECHNICAL FIXTURE');
  await expect(page.getByText('Step 1 of 3')).toBeVisible();

  // Step 1: a high star belongs to the helper; the low near-pole star is the target.
  const heights = await altitudes(page);
  const lowIndex = heights.indexOf(Math.min(...heights));
  const highIndex = heights.indexOf(Math.max(...heights));
  await starButtons(page).nth(lowIndex).click();
  await expect(page.getByLabel('Feedback')).toContainText('Try again');
  await starButtons(page).nth(highIndex).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await expect(page.getByLabel('Feedback')).toContainText('Synthetic guide line.');

  // Step 2: select the target with the keyboard (focus it in the list, press Enter).
  await starButtons(page).nth(lowIndex).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Step 3 of 3')).toBeVisible();

  // Step 3: compass labels and heading readout are hidden; turn from east to north.
  await expect(page.getByText(/Facing \d+°/)).toHaveCount(0);
  const sky = page.getByRole('application');
  await sky.focus();
  for (let i = 0; i < 45; i += 1) await sky.press('ArrowLeft');
  await page.getByRole('button', { name: 'Confirm: I am facing True North' }).click();
  await expect(page.getByLabel('Feedback')).toContainText('differs from True North by 0.0 degrees');
  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();
});

test('synthetic lesson: server selects the alternative route when the helper is down', async ({
  page,
}) => {
  await startSyntheticLesson(page, /Synthetic scenario B \(route B\)/);
  await expect(page.getByRole('heading', { name: 'Synthetic route B' })).toBeVisible();
});

test('real ScientificProfileV1 data fails closed until it is approved', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Dataset').selectOption({ index: 0 });
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.getByRole('alert')).toContainText(
    /NOT_SCIENTIFICALLY_APPROVED|NOT_APPROVED|REQUIRED/,
  );
});
