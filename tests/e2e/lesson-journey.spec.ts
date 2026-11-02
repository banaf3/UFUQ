// Browser evidence on the visibly synthetic technical fixture: complete journeys using
// only keyboard/accessible controls, with the server deciding route, targets, correctness
// and the issued support level (Phase 2 slice, adaptive since Phase 3).
import { expect, test, type Page } from '@playwright/test';

async function startSyntheticLesson(page: Page, scenarioLabel: string) {
  await page
    .getByLabel('Dataset')
    .selectOption({ label: 'Synthetic technical fixture (not the real sky)' });
  await page.getByLabel('Scenario').selectOption({ label: scenarioLabel });
  await page.getByRole('button', { name: 'Start lesson' }).click();
}

function starButtons(page: Page) {
  return page.locator('.star-list').getByRole('listitem').getByRole('button');
}

/** Reads the accessible star list and returns altitudes keyed by button index. */
async function altitudes(page: Page): Promise<number[]> {
  const labels = await starButtons(page).evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label') ?? ''),
  );
  return labels.map((label) => Number(/altitude (-?\d+) degrees/.exec(label)?.[1] ?? 'NaN'));
}

async function faceNorthAndConfirm(page: Page) {
  await expect(page.getByText(/Facing \d+°/)).toHaveCount(0);
  const sky = page.getByRole('application');
  await sky.focus();
  // The view starts facing east; 45 two-degree turns face north.
  for (let i = 0; i < 45; i += 1) await sky.press('ArrowLeft');
  await page.getByRole('button', { name: 'Confirm: I am facing True North' }).click();
}

test('adaptive synthetic lesson: guided first, support fades in the next lesson', async ({
  page,
}) => {
  await page.goto('/');
  await startSyntheticLesson(page, 'Synthetic scenario A (route A)');
  await expect(page.getByRole('heading', { name: 'Synthetic route A' })).toBeVisible();
  await expect(page.getByRole('note').first()).toContainText('SYNTHETIC TECHNICAL FIXTURE');
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await expect(page.getByTestId('support-level')).toContainText('GUIDED');
  await expect(page.getByText('Hint: Synthetic zigzag of five stars.')).toBeVisible();

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

  // Step 3: graded only because the synthetic fixture carries a synthetic tolerance.
  await faceNorthAndConfirm(page);
  await expect(page.getByLabel('Feedback')).toContainText('differs from True North by 0.0 degrees');
  await expect(page.getByLabel('Feedback')).toContainText('synthetic-direction-tolerance');
  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();
  await page.getByTestId('model-trace').locator('summary').click();
  await expect(page.getByTestId('model-trace')).toContainText('TRANSITION_ONLY');

  // Lesson 2 for the same development learner: the target-star skill is now FADING.
  await page.getByRole('button', { name: 'Choose another scenario' }).click();
  await startSyntheticLesson(page, 'Synthetic scenario A (route A)');
  await expect(page.getByTestId('support-level')).toContainText('GUIDED');
  await starButtons(page).nth(highIndex).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await expect(page.getByTestId('support-level')).toContainText('FADING');
});

test('synthetic route B: select every member of the helper pattern', async ({ page }) => {
  await page.goto('/');
  await startSyntheticLesson(page, 'Synthetic scenario B (route B)');
  await expect(page.getByRole('heading', { name: 'Synthetic route B' })).toBeVisible();
  await expect(page.getByText('Select every star of synthetic helper B')).toBeVisible();
  // GUIDED support outlines the pattern (a worked example), which labels its members.
  const members = starButtons(page).filter({ hasText: 'Synthetic helper B' });
  await expect(members).toHaveCount(7);
  for (let i = 0; i < 6; i += 1) await members.nth(i).click();
  await page.getByRole('button', { name: 'Submit selection (6 stars)' }).click();
  await expect(page.getByLabel('Feedback')).toContainText('Try again');
  await members.nth(6).click();
  await page.getByRole('button', { name: 'Submit selection (7 stars)' }).click();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
});

test('real ScientificProfileV1 data fails closed until it is approved', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Dataset').selectOption({ index: 0 });
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.getByRole('alert')).toContainText(
    /NOT_SCIENTIFICALLY_APPROVED|NOT_APPROVED|REQUIRED/,
  );
});
