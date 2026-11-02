import { describe, expect, it } from 'vitest';

import {
  applyModelDecision,
  attemptsToThreshold,
  type BktParameterSet,
  classifyMasteryThreshold,
  crossingsCausedByTransition,
  falseMasteryProbability,
  incorrectEvidenceLowerFixedPoint,
  initialMasteryState,
  learningTransition,
  posteriorAfterObservation,
  recoveryAfterErrors,
  runSequence,
  validateBktParameters,
  validateMasteryThresholdPolicy,
} from '../src/index.js';
import { REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, seededRandom } from './fixtures.js';

describe('BKT worked examples (TUTORING_BKT_SPEC.md, printed to 12 digits)', () => {
  it('reproduces the report correct and incorrect examples from .60', () => {
    const correct = posteriorAfterObservation(0.6, 'CORRECT', REPORT_EXAMPLE) as number;
    expect(correct).toBeCloseTo(0.870967741935, 12);
    expect(learningTransition(correct, REPORT_EXAMPLE)).toBeCloseTo(0.883870967742, 12);
    const incorrect = posteriorAfterObservation(0.6, 'INCORRECT', REPORT_EXAMPLE) as number;
    expect(incorrect).toBeCloseTo(0.157894736842, 12);
    expect(learningTransition(incorrect, REPORT_EXAMPLE)).toBeCloseTo(0.242105263158, 12);
  });

  it.each([
    [
      ['CORRECT', 'CORRECT', 'CORRECT'],
      [0.576470588235, 0.873684210526, 0.971984435798],
    ],
    [
      ['INCORRECT', 'INCORRECT', 'INCORRECT'],
      [0.127272727273, 0.116112531969, 0.114539890399],
    ],
    [
      ['CORRECT', 'INCORRECT', 'CORRECT'],
      [0.576470588235, 0.230860534125, 0.617134416544],
    ],
  ] as const)('reproduces the sequence %j from L0', (steps, expected) => {
    const points = runSequence(REPORT_EXAMPLE, steps);
    points.forEach((point, index) => expect(point.next).toBeCloseTo(expected[index] as number, 12));
  });

  it('shows two correct observations from .20 meet the provisional .85 threshold', () => {
    expect(attemptsToThreshold(REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, 'CORRECT', 10)).toBe(2);
  });
});

describe('parameter and state guards', () => {
  it('accepts the report example set', () => {
    expect(validateBktParameters(REPORT_EXAMPLE)).toEqual([]);
  });

  it.each([
    ['NaN guess', { guess: Number.NaN }],
    ['slip above one', { slip: 1.2 }],
    ['negative learn', { learn: -0.1 }],
    ['infinite prior', { initialMastery: Number.POSITIVE_INFINITY }],
    ['1 - S equal to G', { guess: 0.5, slip: 0.5 }],
    ['inverted model', { guess: 0.6, slip: 0.5 }],
    ['empty identifier', { parameterSetId: '' }],
  ])('rejects %s', (_label, change) => {
    expect(validateBktParameters({ ...REPORT_EXAMPLE, ...change } as BktParameterSet)).not.toEqual(
      [],
    );
  });

  it('refuses an impossible observation instead of dividing by zero', () => {
    const noGuess = { ...REPORT_EXAMPLE, guess: 0 };
    expect(posteriorAfterObservation(0, 'CORRECT', noGuess)).toBeNull();
    const result = applyModelDecision(
      { ...initialMasteryState('KC-01', noGuess), masteryProbability: 0 },
      { kind: 'OBSERVATION', evidence: 'CORRECT', reasonCode: 'TEST_OBSERVATION' },
      noGuess,
      0,
    );
    expect(result).toMatchObject({ ok: false, failure: 'ZERO_LIKELIHOOD_OBSERVATION' });
    const noSlip = { ...REPORT_EXAMPLE, slip: 0 };
    expect(posteriorAfterObservation(1, 'INCORRECT', noSlip)).toBeNull();
  });

  it('keeps the boundary priors at their fixed values', () => {
    expect(posteriorAfterObservation(0, 'CORRECT', REPORT_EXAMPLE)).toBe(0);
    expect(posteriorAfterObservation(1, 'INCORRECT', REPORT_EXAMPLE)).toBe(1);
    expect(learningTransition(1, REPORT_EXAMPLE)).toBe(1);
  });

  it('rejects stale revisions, foreign chains, invalid states and reason codes', () => {
    const state = initialMasteryState('KC-01', REPORT_EXAMPLE);
    const instruction = { kind: 'TRANSITION_ONLY', reasonCode: 'TEST_TRANSITION' } as const;
    expect(applyModelDecision(state, instruction, REPORT_EXAMPLE, 1)).toMatchObject({
      failure: 'STALE_MASTERY_REVISION',
    });
    expect(
      applyModelDecision(state, instruction, { ...REPORT_EXAMPLE, parameterSetVersion: '2' }, 0),
    ).toMatchObject({ failure: 'MODEL_CHAIN_MISMATCH' });
    expect(
      applyModelDecision({ ...state, masteryProbability: 1.5 }, instruction, REPORT_EXAMPLE, 0),
    ).toMatchObject({ failure: 'INVALID_MASTERY_STATE' });
    expect(
      applyModelDecision(state, { ...instruction, reasonCode: 'lower case' }, REPORT_EXAMPLE, 0),
    ).toMatchObject({ failure: 'INVALID_REASON_CODE' });
    expect(
      applyModelDecision(state, instruction, { ...REPORT_EXAMPLE, guess: 0.95 }, 0),
    ).toMatchObject({ failure: 'INVALID_PARAMETERS' });
  });
});

describe('typed model decisions', () => {
  const state = initialMasteryState('KC-02', REPORT_EXAMPLE);

  it('names prior, posterior and transitioned values for an observation', () => {
    const result = applyModelDecision(
      state,
      { kind: 'OBSERVATION', evidence: 'CORRECT', reasonCode: 'TEST_OBSERVATION' },
      REPORT_EXAMPLE,
      0,
    );
    if (!result.ok || result.record.kind !== 'OBSERVATION') throw new Error('expected observation');
    expect(result.record.priorMastery).toBe(0.2);
    expect(result.record.posteriorAfterObservation).toBeCloseTo(0.529411764706, 12);
    expect(result.record.nextMasteryAfterTransition).toBeCloseTo(0.576470588235, 12);
    expect([result.record.priorRevision, result.record.nextRevision]).toEqual([0, 1]);
    expect(result.nextState.masteryRevision).toBe(1);
  });

  it('applies the transition once and skips the likelihood for TRANSITION_ONLY', () => {
    const result = applyModelDecision(
      state,
      { kind: 'TRANSITION_ONLY', reasonCode: 'TEST_TRANSITION' },
      REPORT_EXAMPLE,
      0,
    );
    if (!result.ok || result.record.kind !== 'TRANSITION_ONLY')
      throw new Error('expected transition');
    expect(result.record.observationApplied).toBe(false);
    expect(result.record.masteryBeforeTransition).toBe(0.2);
    expect(result.record.nextMasteryAfterTransition).toBeCloseTo(0.28, 15);
    expect(result.nextState.masteryRevision).toBe(1);
  });

  it('records an explicit no-op without changing mastery or revision', () => {
    const result = applyModelDecision(
      state,
      { kind: 'NO_MODEL_UPDATE', reasonCode: 'TEST_NO_UPDATE' },
      REPORT_EXAMPLE,
      0,
    );
    if (!result.ok || result.record.kind !== 'NO_MODEL_UPDATE') throw new Error('expected no-op');
    expect(result.record.masteryUnchanged).toBe(0.2);
    expect(result.record.revisionUnchanged).toBe(0);
    expect(result.nextState).toBe(state);
  });
});

describe('model properties (seeded; seed 20261102, mulberry32, 5000 cases)', () => {
  it('keeps every value in [0, 1] and orders posterior, prior and transition', () => {
    const random = seededRandom(20261102);
    for (let index = 0; index < 5000; index += 1) {
      const guess = random() * 0.49;
      const slip = random() * 0.49;
      const parameters: BktParameterSet = {
        ...REPORT_EXAMPLE,
        guess,
        slip,
        learn: random(),
        initialMastery: random(),
      };
      expect(validateBktParameters(parameters)).toEqual([]);
      const prior = 0.001 + random() * 0.998;
      const correct = posteriorAfterObservation(prior, 'CORRECT', parameters) as number;
      const incorrect = posteriorAfterObservation(prior, 'INCORRECT', parameters) as number;
      // Interior prior and informative evidence: strict movement (TUTORING_BKT_SPEC.md).
      expect(correct).toBeGreaterThan(prior);
      expect(incorrect).toBeLessThan(prior);
      for (const posterior of [correct, incorrect]) {
        const next = learningTransition(posterior, parameters);
        expect(posterior).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(1);
        expect(next).toBeGreaterThanOrEqual(posterior);
      }
    }
  });
});

describe('fixed point and behaviour analysis', () => {
  it('finds the DEV-008 lower fixed point and the incorrect-but-higher region below it', () => {
    const point = incorrectEvidenceLowerFixedPoint(REPORT_EXAMPLE) as number;
    expect(point).toBeCloseTo(0.114285714286, 12);
    const [atPoint] = runSequence(REPORT_EXAMPLE, ['INCORRECT'], point);
    expect(Math.abs((atPoint?.next ?? 0) - point)).toBeLessThan(1e-15);
    const [below] = runSequence(REPORT_EXAMPLE, ['INCORRECT'], 0.05);
    expect(below?.next).toBeGreaterThan(0.05);
    const [above] = runSequence(REPORT_EXAMPLE, ['INCORRECT'], 0.5);
    expect(above?.next).toBeLessThan(0.5);
  });

  it('computes the false-mastery probability of a pure guesser exactly', () => {
    // From .20 only correct-correct reaches .85 within two or three observations.
    expect(falseMasteryProbability(REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, 2)).toBeCloseTo(0.04, 15);
    expect(falseMasteryProbability(REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, 3)).toBeCloseTo(0.04, 15);
    expect(falseMasteryProbability(REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, 0)).toBe(0);
  });

  it('measures recovery after errors and transition-caused crossings', () => {
    expect(recoveryAfterErrors(REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, 0, 10)).toBe(2);
    expect(recoveryAfterErrors(REPORT_EXAMPLE, SYNTHETIC_THRESHOLD, 2, 10)).toBe(3);
    const points = runSequence(REPORT_EXAMPLE, ['CORRECT', 'CORRECT']);
    const strict = { ...SYNTHETIC_THRESHOLD, threshold: 0.87 };
    // The second posterior (.8597) is below .87; the transition lifts it to .8737.
    expect(crossingsCausedByTransition(points, strict)).toBe(1);
    expect(crossingsCausedByTransition(points, SYNTHETIC_THRESHOLD)).toBe(0);
  });
});

describe('mastery threshold status (BKT-003 input)', () => {
  it('states the boundary rule explicitly', () => {
    expect(classifyMasteryThreshold(0.85, SYNTHETIC_THRESHOLD).status).toBe('MEETS_THRESHOLD');
    expect(
      classifyMasteryThreshold(0.85, { ...SYNTHETIC_THRESHOLD, comparison: 'ABOVE' }).status,
    ).toBe('BELOW_THRESHOLD');
    expect(classifyMasteryThreshold(0.99, null)).toEqual({ status: 'THRESHOLD_POLICY_UNRESOLVED' });
  });

  it('validates the threshold policy', () => {
    expect(validateMasteryThresholdPolicy(SYNTHETIC_THRESHOLD)).toEqual([]);
    expect(validateMasteryThresholdPolicy({ ...SYNTHETIC_THRESHOLD, threshold: 1.01 })).not.toEqual(
      [],
    );
  });
});
