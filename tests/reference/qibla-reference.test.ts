// Runtime spherical Qibla bearing against the independent standard-library oracle
// (tools/qibla-reference, unit-vector method in 50-digit decimals). The fixture rounds to
// 1e-12 degrees; binary64 evaluation of the atan2 form is good to about 1e-13 degrees for
// these geometries, so 2e-12 degrees bounds rounding plus arithmetic. It verifies the
// implementation only; it is not a learner or scientific tolerance.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sphericalInitialBearing } from '@ufuq/astronomy-core';

interface Fixture {
  generatorId: string;
  destination: { latitudeDegrees: string; longitudeDegrees: string };
  cases: {
    caseId: string;
    observer: { latitudeDegrees: string; longitudeDegrees: string };
    expectedAzimuthDegrees: string;
  }[];
}

const fixture = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      '../../tools/qibla-reference/fixtures/qibla-reference-output.v1.json',
    ),
    'utf8',
  ),
) as Fixture;
const BOUND_DEGREES = 2e-12;

describe('spherical Qibla bearing against the independent oracle', () => {
  it('uses the independent generator', () => {
    expect(fixture.generatorId).toBe('ufuq-qibla-reference');
    expect(fixture.cases.length).toBeGreaterThanOrEqual(10);
  });

  it.each(fixture.cases.map((c) => [c.caseId, c] as const))('%s', (_id, testCase) => {
    const result = sphericalInitialBearing(
      {
        latitudeDegrees: Number(testCase.observer.latitudeDegrees),
        longitudeDegrees: Number(testCase.observer.longitudeDegrees),
      },
      {
        latitudeDegrees: Number(fixture.destination.latitudeDegrees),
        longitudeDegrees: Number(fixture.destination.longitudeDegrees),
      },
    );
    if (result.kind !== 'BEARING') throw new Error(result.reason);
    const actual = (result.azimuthRadians * 180) / Math.PI;
    const expected = Number(testCase.expectedAzimuthDegrees);
    const wrapped = Math.abs(((actual - expected + 540) % 360) - 180);
    expect(wrapped).toBeLessThanOrEqual(BOUND_DEGREES);
  });
});
