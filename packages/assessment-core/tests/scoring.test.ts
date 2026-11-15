import { describe, expect, it } from 'vitest';

import {
  measureDirectionAnswer,
  scoredOutcomeOf,
  scorePointedLocation,
  scoreStarSelection,
  scoreStarSetSelection,
  wrappedAzimuthDifference,
} from '../src/index.js';

describe('assessment scoring', () => {
  it('scores star identity exactly', () => {
    const accepted = new Set(['a', 'b']);
    expect(scoreStarSelection('a', accepted).result).toBe('CORRECT');
    expect(scoreStarSelection('c', accepted).result).toBe('INCORRECT');
    expect(scoreStarSelection(null, accepted).result).toBe('INCORRECT');
  });

  it('wraps azimuth differences across north', () => {
    expect(wrappedAzimuthDifference(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, 12);
    expect(wrappedAzimuthDifference(Math.PI, 0)).toBeCloseTo(Math.PI, 12);
    expect(wrappedAzimuthDifference(-0.25, 0.25)).toBeCloseTo(0.5, 12);
    expect(() => wrappedAzimuthDifference(Number.NaN, 0)).toThrow();
  });

  it('reports a measurement without classification when no tolerance is approved', () => {
    const measurement = measureDirectionAnswer(0.05, 0, null);
    expect(measurement.result).toBe('MEASURED_NO_TOLERANCE');
    expect(measurement.angularDifferenceRadians).toBeCloseTo(0.05, 12);
  });

  it('classifies only against an explicitly supplied policy', () => {
    const policy = {
      policyId: 'synthetic-test-policy',
      maximumDifferenceRadians: 0.1,
      approvalReference: 'test',
    };
    expect(measureDirectionAnswer(0.05, 0, policy).result).toBe('WITHIN_APPROVED_TOLERANCE');
    expect(measureDirectionAnswer(0.5, 0, policy).result).toBe('OUTSIDE_APPROVED_TOLERANCE');
  });
});

describe('Phase 3 answer types: boundaries, wrap and invalid input', () => {
  const policy = {
    policyId: 'synthetic-boundary-policy',
    maximumDifferenceRadians: 0.1,
    approvalReference: 'synthetic technical fixture',
  };

  it('treats the tolerance boundary as inclusive and wraps across north', () => {
    expect(measureDirectionAnswer(0.1, 0, policy).result).toBe('WITHIN_APPROVED_TOLERANCE');
    expect(measureDirectionAnswer(0.1 + 1e-12, 0, policy).result).toBe(
      'OUTSIDE_APPROVED_TOLERANCE',
    );
    expect(measureDirectionAnswer(2 * Math.PI - 0.05, 0, policy).result).toBe(
      'WITHIN_APPROVED_TOLERANCE',
    );
    expect(measureDirectionAnswer(-0.05, 0, policy).result).toBe('WITHIN_APPROVED_TOLERANCE');
    expect(measureDirectionAnswer(4 * Math.PI + 0.02, 0, policy).result).toBe(
      'WITHIN_APPROVED_TOLERANCE',
    );
  });

  it('rejects a non-finite answer and a malformed tolerance', () => {
    expect(() => measureDirectionAnswer(Number.POSITIVE_INFINITY, 0, policy)).toThrow();
    expect(() =>
      measureDirectionAnswer(0, 0, { ...policy, maximumDifferenceRadians: Number.NaN }),
    ).toThrow();
    expect(() =>
      measureDirectionAnswer(0, 0, { ...policy, maximumDifferenceRadians: 4 }),
    ).toThrow();
  });

  it('scores a member set by exact equality with diagnostics only', () => {
    const members = new Set(['a', 'b', 'c']);
    expect(scoreStarSetSelection(['c', 'a', 'b'], members)).toEqual({
      result: 'CORRECT',
      selectedCount: 3,
    });
    expect(scoreStarSetSelection(['a', 'b'], members)).toMatchObject({
      result: 'INCORRECT',
      missingCount: 1,
      extraCount: 0,
    });
    expect(scoreStarSetSelection(['a', 'b', 'c', 'x'], members)).toMatchObject({
      result: 'INCORRECT',
      extraCount: 1,
    });
    expect(scoreStarSetSelection(['a', 'a', 'b', 'c'], members)).toMatchObject({
      result: 'INCORRECT',
      invalidSelection: true,
    });
    expect(scoreStarSetSelection(['a', 'b', 'c', null], members)).toMatchObject({
      result: 'INCORRECT',
      invalidSelection: true,
    });
    expect(scoreStarSetSelection([], new Set())).toMatchObject({ result: 'INCORRECT' });
  });

  it('hands the learner model binary evidence only when it exists', () => {
    expect(scoredOutcomeOf(scoreStarSelection('a', new Set(['a'])))).toBe('CORRECT');
    expect(scoredOutcomeOf(scoreStarSetSelection(['a'], new Set(['b'])))).toBe('INCORRECT');
    expect(scoredOutcomeOf(measureDirectionAnswer(0.3, 0, null))).toBe('UNCLASSIFIED');
    expect(scoredOutcomeOf(measureDirectionAnswer(0.3, 0, policy))).toBe('INCORRECT');
  });
});

describe('pointing the circle at the answer', () => {
  const north: readonly [number, number, number] = [0, 1, 0];
  const accepted = new Map<string, readonly [number, number, number]>([
    ['near', [0, Math.cos(10 * (Math.PI / 180)), Math.sin(10 * (Math.PI / 180))]],
    ['far', [1, 0, 0]],
  ]);

  it('is correct inside the circle and reports the nearest star', () => {
    const inside = scorePointedLocation(north, accepted, 11 * (Math.PI / 180));
    expect(inside).toMatchObject({ result: 'CORRECT', nearestStarId: 'near' });
    const outside = scorePointedLocation(north, accepted, 9 * (Math.PI / 180));
    expect(outside).toMatchObject({ result: 'INCORRECT', nearestStarId: 'near' });
    expect(scoredOutcomeOf(inside)).toBe('CORRECT');
    expect(scoredOutcomeOf(outside)).toBe('INCORRECT');
  });

  it('includes the circle edge and never accepts a non-finite or empty answer', () => {
    const edge = scorePointedLocation(north, accepted, 10 * (Math.PI / 180) + 1e-12);
    expect(edge.result).toBe('CORRECT');
    expect(scorePointedLocation([Number.NaN, 0, 0], accepted, 1).result).toBe('INCORRECT');
    expect(scorePointedLocation(north, new Map(), 1)).toEqual({
      result: 'INCORRECT',
      nearestStarId: null,
      separationRadians: null,
    });
    expect(() => scorePointedLocation(north, accepted, -1)).toThrow(RangeError);
    expect(() => scorePointedLocation(north, accepted, Number.NaN)).toThrow(RangeError);
  });
});
