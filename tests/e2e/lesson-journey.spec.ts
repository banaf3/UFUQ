// Browser evidence on the visibly synthetic technical fixture: complete journeys using
// only keyboard/accessible controls, with the server deciding route, targets, correctness
// and the issued support level (Phase 2 slice, adaptive since Phase 3).
import { expect, test, type Page } from '@playwright/test';

/**
 * From the sky explorer: pick the synthetic scenario, wait for its sky, start the lesson,
 * then skip the taught walkthrough to the assessment.
 */
async function startSyntheticLesson(page: Page, scenarioLabel: string, utc: string) {
  await openWalkthrough(page, scenarioLabel, utc);
  await page.getByRole('button', { name: 'Skip to the assessment' }).click();
}

async function openWalkthrough(page: Page, scenarioLabel: string, utc: string) {
  await expect(page.getByLabel('Data')).toHaveValue(
    'synthetic-technical|SYNTHETIC_TECHNICAL_FIXTURE',
    {
      timeout: 20_000,
    },
  );
  await page.getByLabel('Scenario').selectOption({ label: scenarioLabel });
  await expect(page.locator('.sky-notice summary')).toContainText(utc);
  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.getByText('Learn the route')).toBeVisible();
}

function starButtons(page: Page) {
  return page.locator('.star-list').getByRole('listitem').getByRole('button');
}

/** The lesson view starts at azimuth 90 and altitude 12 degrees (LessonView INITIAL_VIEW). */
interface View {
  az: number;
  alt: number;
}
const START: View = { az: 90, alt: 12 };

/** East-north-up direction to the azimuth and altitude (degrees) of the circle's place. */
function place(enu: readonly number[]): View {
  const [e, n, u] = enu as [number, number, number];
  return {
    az: ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360,
    alt: (Math.asin(u) * 180) / Math.PI,
  };
}

/**
 * Moves the circle with the keyboard: each arrow press turns the view 2 degrees. The
 * circle's radius is 4% of the 100 degree field, i.e. 4 degrees, so 2 degree steps are fine.
 */
async function moveCircleTo(page: Page, from: View, to: View): Promise<View> {
  const sky = page.getByRole('application');
  await sky.focus();
  const turn = (((to.az - from.az + 540) % 360) - 180) / 2;
  const tilt = (to.alt - from.alt) / 2;
  for (let i = 0; i < Math.abs(Math.round(turn)); i += 1)
    await sky.press(turn < 0 ? 'ArrowLeft' : 'ArrowRight');
  for (let i = 0; i < Math.abs(Math.round(tilt)); i += 1)
    await sky.press(tilt < 0 ? 'ArrowDown' : 'ArrowUp');
  return {
    az: from.az + Math.round(turn) * 2,
    alt: from.alt + Math.round(tilt) * 2,
  };
}

/** A correct answer waits for the learner: the result card has a Next button. */
async function next(page: Page, label = 'Next →') {
  await page.getByRole('button', { name: label }).click();
}

async function confirmCircle(page: Page) {
  await page.getByRole('button', { name: 'Confirm: the circle is on it' }).click();
}

/** What the API sent for the current lesson: star directions and the revealed answer stars. */
function watchLesson(page: Page) {
  const seen = {
    stars: new Map<string, readonly number[]>(),
    helper: null as readonly number[] | null,
    target: null as readonly number[] | null,
  };
  const outlineMember = (overlays: { kind: string; memberHandles?: string[] }[]) =>
    overlays.find((o) => o.kind === 'PATTERN_OUTLINE')?.memberHandles?.[0];
  page.on('response', (response) => {
    if (!response.url().includes('/api/v2/lessons')) return;
    void response
      .json()
      .then((body) => {
        for (const star of body.stars ?? []) seen.stars.set(star.handle, star.enu);
        const steps = [body.currentStep, body.nextStep].filter(Boolean);
        for (const step of steps) {
          const member = outlineMember(step.overlays);
          if (member && seen.stars.has(member) && !seen.helper)
            seen.helper = seen.stars.get(member) ?? null;
          const arc = step.overlays.find((o: { kind: string }) => o.kind === 'GUIDE_ARC');
          const last = arc?.handles?.at(-1);
          if (last && seen.stars.has(last) && !seen.target)
            seen.target = seen.stars.get(last) ?? null;
        }
      })
      .catch(() => undefined);
  });
  return seen;
}

/** From True North, 35 two-degree turns to the west face the synthetic destination (about 290.6 degrees). */
async function faceQiblaAndConfirm(page: Page, from: View) {
  await moveCircleTo(page, from, { az: 290, alt: from.alt });
  await page.getByRole('button', { name: 'Confirm: I am facing the Qibla' }).click();
}

async function faceNorthAndConfirm(page: Page, from: View): Promise<View> {
  await expect(page.getByText(/Facing d+°/)).toHaveCount(0);
  const at = await moveCircleTo(page, from, { az: 0, alt: from.alt });
  await page.getByRole('button', { name: 'Confirm: I am facing True North' }).click();
  return at;
}

test('adaptive synthetic lesson: guided first, support fades in the next lesson', async ({
  page,
}) => {
  await page.goto('/');
  const seen = watchLesson(page);
  await startSyntheticLesson(page, 'Synthetic scenario A (route A)', '2026-11-15T13:00:00Z');
  await expect(page.getByRole('heading', { name: 'Synthetic route A' })).toBeVisible();
  await expect(page.getByRole('note').first()).toContainText('SYNTHETIC TECHNICAL FIXTURE');
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await expect(page.getByTestId('support-level')).toContainText('Guided');
  await expect(page.getByText('Hint: Synthetic zigzag of five stars.')).toBeVisible();

  // Step 1: put the circle on the helper. Empty sky first: the answer is checked by place.
  await expect(page.getByRole('button', { name: /Star d/ })).toHaveCount(0); // no list to pick from
  await confirmCircle(page);
  await expect(page.getByLabel('Feedback')).toContainText('Try again');
  await expect.poll(() => seen.helper).not.toBeNull();
  let at = await moveCircleTo(page, START, place(seen.helper as number[]));
  await confirmCircle(page);
  await expect(page.getByLabel('Feedback')).toContainText('The circle was');
  await expect(page.getByText('Step 1 of 4')).toBeVisible(); // waits for Next
  await next(page);
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await expect(page.getByLabel('Feedback')).toContainText('Synthetic guide line.');

  // Step 2: the target star near the pole, found by moving the circle to it.
  await expect.poll(() => seen.target).not.toBeNull();
  at = await moveCircleTo(page, at, place(seen.target as number[]));
  await confirmCircle(page);
  await next(page);
  await expect(page.getByText('Step 3 of 4')).toBeVisible();

  // Step 3: graded only because the synthetic fixture carries a synthetic tolerance.
  at = await faceNorthAndConfirm(page, at);
  await expect(page.getByLabel('Feedback')).toContainText('differs from True North by 0.0 degrees');
  await expect(page.getByLabel('Feedback')).toContainText('inside the 10.0° tolerance');
  await next(page);
  await expect(page.getByText('Step 4 of 4')).toBeVisible();
  // The Qibla step shows the compass ring and the bearing the learner faces.
  await expect(page.getByText(/Facing d+° from True North/)).toBeVisible();

  // Step 4: the Qibla, computed for the observer and graded by the same synthetic tolerance.
  await faceQiblaAndConfirm(page, at);
  await expect(page.getByLabel('Feedback')).toContainText('differs from the Qibla by 0.6 degrees');
  await next(page, 'Finish');
  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();
  await page.getByTestId('model-trace').locator('summary').click();
  await expect(page.getByTestId('model-trace')).toContainText('TRANSITION_ONLY');

  // Lesson 2 for the same development learner: the target-star skill is now FADING.
  await page.getByRole('button', { name: 'Back to the sky' }).click();
  await startSyntheticLesson(page, 'Synthetic scenario A (route A)', '2026-11-15T13:00:00Z');
  await expect(page.getByTestId('support-level')).toContainText('Guided');
  await moveCircleTo(page, START, place(seen.helper as number[]));
  await confirmCircle(page);
  await next(page);
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await expect(page.getByTestId('support-level')).toContainText('Lines only');
});

test('synthetic route B: select every member of the helper pattern', async ({ page }) => {
  await page.goto('/');
  await startSyntheticLesson(page, 'Synthetic scenario B (route B)', '2026-05-15T14:00:00Z');
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
  await next(page);
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
});

test('real ScientificProfileV1 data fails closed until it is approved', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Data')).toHaveValue(/synthetic/, { timeout: 20_000 });
  await page.getByLabel('Data').selectOption('profile-v1-umpsa-pekan|SCIENTIFIC_PROFILE_V1');
  await expect(page.getByRole('alert')).toContainText(
    /NOT_SCIENTIFICALLY_APPROVED|NOT_APPROVED|REQUIRED/,
  );
});

test('the taught walkthrough traces the route frame by frame before the assessment', async ({
  page,
}) => {
  await page.goto('/');
  await openWalkthrough(page, 'Synthetic scenario A (route A)', '2026-11-15T13:00:00Z');
  await expect(page.getByRole('heading', { name: 'Synthetic route A' })).toBeVisible();
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await expect(page.getByText('Synthetic helper pattern.')).toBeVisible();
  for (let frame = 2; frame <= 5; frame += 1) {
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.getByText(`Step ${frame} of 5`)).toBeVisible();
  }
  // The last frame turns from True North to the Qibla and states the bearing.
  await expect(page.getByText(/the Qibla is \d+° \d\d′ clockwise from True North/)).toBeVisible();
  await page.getByRole('button', { name: 'Start the assessment' }).click();
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await expect(page.getByTestId('support-level')).toContainText('Guided');
});
