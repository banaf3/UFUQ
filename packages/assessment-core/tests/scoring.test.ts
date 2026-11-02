import { describe, expect, it } from 'vitest';

import {
  measureDirectionAnswer,
  scoreStarSelection,
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
