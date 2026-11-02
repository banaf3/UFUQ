// Production/reference comparison for the pure BKT module (TUTORING_BKT_SPEC.md,
// "Numerical constraints"; TEST_PLAN.md Phase 3).
//
// tools/bkt-reference evaluates the specification's equations with exact rational
// arithmetic (Python fractions, standard library only) on the exact binary64 values of
// its inputs, so each residual below is the TypeScript implementation's own rounding
// error. The oracle shares no code with production.
//
// Bound: an a-priori first-order forward-error bound per value, not one global number
// (the specification warns that no convenient global tolerance holds near degenerate
// boundaries). With u = 2^-53, one posterior evaluation rounds at most 6u relative (two
// products per likelihood, one sum of non-negative terms, one division) and one
// transition at most 3u absolute; the test doubles both (12u, 8u) and propagates earlier
// error through the exact derivative of the update map, |d posterior / d prior| =
// ab/(pa + (1-p)b)^2, times (1 - T) for the transition. It is an
// implementation-verification bound, not an educational, threshold or calibration
// tolerance (BKT-002).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { type BktParameterSet, runSequence, type SequenceStep } from '@ufuq/tutoring-core';

const root = resolve(import.meta.dirname, '..', '..');
const directory = join(root, 'tools', 'bkt-reference', 'fixtures');
const text = readFileSync(join(directory, 'bkt-reference-output.v1.json'), 'utf8');
const digest = readFileSync(join(directory, 'bkt-reference-output.v1.sha256'), 'utf8').trim();

interface ReferenceCase {
  readonly caseId: string;
  readonly parameters: Record<'initialMastery' | 'learn' | 'guess' | 'slip', string>;
  readonly start: string | null;
  readonly steps: string;
  readonly expected: readonly { prior: string; posterior: string; next: string }[];
}
const fixture = JSON.parse(text) as {
  fixtureType: string;
  inputInterpretation: string;
  random: { seed: number; caseCount: number };
  cases: ReferenceCase[];
};

const U = 2 ** -53;
const LOCAL_POSTERIOR = 12 * U;
const LOCAL_TRANSITION = 8 * U;

/** Derivative of the posterior with respect to the prior (1 when no likelihood applies). */
function posteriorSlope(prior: number, step: SequenceStep, p: BktParameterSet): number {
  if (step === 'TRANSITION_ONLY' || step === 'NO_MODEL_UPDATE') return 1;
  const a = step === 'CORRECT' ? 1 - p.slip : p.slip;
  const b = step === 'CORRECT' ? p.guess : 1 - p.guess;
  const denominator = prior * a + (1 - prior) * b;
  return (a * b) / (denominator * denominator);
}
const STEP: Record<string, SequenceStep> = {
  C: 'CORRECT',
  I: 'INCORRECT',
  T: 'TRANSITION_ONLY',
  N: 'NO_MODEL_UPDATE',
};

describe('BKT production/reference comparison (exact rational oracle)', () => {
  it('reads the pinned fixture bytes', () => {
    expect(createHash('sha256').update(text, 'utf8').digest('hex')).toBe(digest);
    expect(fixture.fixtureType).toBe('UFUQ_BKT_REFERENCE');
    expect(fixture.inputInterpretation).toBe('EXACT_BINARY64_VALUE_OF_DECIMAL_TEXT');
    expect(fixture.random).toMatchObject({ seed: 20261102, caseCount: 120 });
    expect(fixture.cases.length).toBe(134);
  });

  let largest = 0;
  let largestRatio = 0;
  it.each(fixture.cases.map((reference) => [reference.caseId, reference] as const))(
    '%s stays within the implementation bound',
    (_id, reference) => {
      const parameters: BktParameterSet = {
        parameterSetId: 'reference',
        parameterSetVersion: '1',
        status: 'SYNTHETIC_TECHNICAL_FIXTURE',
        initialMastery: Number(reference.parameters.initialMastery),
        learn: Number(reference.parameters.learn),
        guess: Number(reference.parameters.guess),
        slip: Number(reference.parameters.slip),
      };
      const start = reference.start === null ? parameters.initialMastery : Number(reference.start);
      const points = runSequence(
        parameters,
        [...reference.steps].map((code) => STEP[code] as SequenceStep),
        start,
      );
      expect(points.length).toBe(reference.expected.length);
      let priorBound = 0;
      points.forEach((point, index) => {
        const expected = reference.expected[index] as ReferenceCase['expected'][number];
        const observed = point.step === 'CORRECT' || point.step === 'INCORRECT';
        const posteriorBound =
          posteriorSlope(point.prior, point.step, parameters) * priorBound +
          (observed ? LOCAL_POSTERIOR : 0);
        const nextBound =
          point.step === 'NO_MODEL_UPDATE'
            ? priorBound
            : (1 - parameters.learn) * posteriorBound + LOCAL_TRANSITION;
        const bounds = { prior: priorBound, posterior: posteriorBound, next: nextBound };
        for (const key of ['prior', 'posterior', 'next'] as const) {
          const residual = Math.abs(point[key] - Number(expected[key]));
          largest = Math.max(largest, residual);
          largestRatio = Math.max(largestRatio, residual / Math.max(bounds[key], U));
          expect(residual).toBeLessThanOrEqual(bounds[key]);
        }
        priorBound = nextBound;
      });
    },
  );

  it('records the largest residual', () => {
    // Measured 2026-11-02; see docs/PHASE3_ASSESSMENT_AND_BKT.md.
    expect(largestRatio).toBeLessThanOrEqual(1);
    console.info(
      `Largest BKT residual ${largest.toExponential(3)}; largest residual/bound ${largestRatio.toFixed(3)}`,
    );
  });
});
