// POST_IMPLEMENTATION production/reference comparison (activates test:reference).
//
// The TypeScript ScientificProfileV1 route (astronomy-core, SOFA-derived) is compared
// with the PyERFA reference produced by tools/astronomy-reference from the same explicit
// inputs. Both derive from IAU SOFA 2023-10-11, so this is
// SHARED_SCIENTIFIC_LINEAGE_IMPLEMENTATION_VERIFICATION: it proves the port reproduces
// the reference algorithm, not that the astronomy is scientifically accepted.
//
// Bound: 1e-12 rad on azimuth and zenith distance, the published SOFA validation
// tolerance for iauAtco13/iauAtioq in t_sofa_c.c (SOFA 2023-10-11). It is an
// implementation-fidelity bound, not an AST-006 scientific or learner tolerance.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRouteContext,
  type CatalogueStarState,
  executeStar,
  parseCanonicalUtc,
  type ScientificApproval,
  taiFromUtc,
  ttFromTai,
  ut1FromTai,
  validateUtcInstant,
} from '@ufuq/astronomy-core';

const root = resolve(import.meta.dirname, '..', '..');
const fixtureDirectory = join(root, 'tools', 'astronomy-reference', 'fixtures');
const inputText = readFileSync(
  join(fixtureDirectory, 'profile-v1-reference-input.v1.json'),
  'utf8',
);
const outputText = readFileSync(
  join(fixtureDirectory, 'profile-v1-reference-output.v1.json'),
  'utf8',
);
const outputHash = readFileSync(
  join(fixtureDirectory, 'profile-v1-reference-output.v1.sha256'),
  'utf8',
).trim();
const input = JSON.parse(inputText);
const output = JSON.parse(outputText);
const leapArtifact = JSON.parse(
  readFileSync(join(root, 'data', 'generated', 'leap-seconds-iers-v1.json'), 'utf8'),
);

const FIDELITY_BOUND_RADIANS = 1e-12;
const DAS2R = Math.PI / 180 / 3600;

// Engine-level comparison: approval is policy, not physics, so the test scopes the leap
// state as a technical fixture. Real execution still requires named approval.
const testApproval: ScientificApproval = {
  state: 'APPROVED',
  scope: 'SYNTHETIC_TECHNICAL_FIXTURE',
  reviewer: 'NOT_APPLICABLE_REFERENCE_TEST',
  decisionDate: null,
  decisionReference: 'tests/reference engine-level comparison',
};
const leap = {
  identity: {
    artifactId: leapArtifact.artifactId,
    artifactVersion: '1',
    payloadSha256: leapArtifact.payloadSha256,
  },
  availability: 'AVAILABLE' as const,
  publisherIntegrity: leapArtifact.payload.transport.publisherIntegrity,
  bulletinCConsistency: leapArtifact.payload.bulletinC.consistency,
  expiryMjd: leapArtifact.payload.expiryMjd,
  transitions: leapArtifact.payload.transitions,
  approval: testApproval,
};
const observer = {
  geodeticLatitudeDegrees: input.observer.geodeticLatitudeDegrees,
  geodeticLongitudeDegrees: input.observer.geodeticLongitudeDegrees,
  height: {
    kind: 'ELLIPSOIDAL' as const,
    valueMetres: input.observer.ellipsoidalHeightMetres,
    ellipsoidId: 'WGS 84',
  },
  referenceEllipsoid: {
    ellipsoidId: 'WGS 84',
    equatorialRadiusMetres: 6378137.0,
    inverseFlattening: 298.257223563,
    source: 'WGS 84',
  },
};

function star(row: Record<string, number | string>): CatalogueStarState {
  return {
    starId: row.starId as string,
    sourceRecordId: row.starId as string,
    rightAscensionRadians: row.rightAscensionRadians as number,
    declinationRadians: row.declinationRadians as number,
    epoch: {
      nativeNotation: input.sourceEpoch.nativeNotation,
      scale: 'TT',
      julianDate: {
        scale: 'TT',
        splitConvention: 'MJD_ZERO_PLUS_OFFSET',
        ...input.sourceEpoch.julianDate,
      },
    },
    properMotion: {
      muAlphaStarMasPerYear: row.muAlphaStarMasPerYear as number,
      muDeltaMasPerYear: row.muDeltaMasPerYear as number,
      durationUnit: 'JULIAN_YEAR',
      derivativeScale: 'TT',
    },
    parallax: { state: 'APPROVED_USABLE_DISTANCE', parallaxMas: row.parallaxMas as number },
    radialVelocity: {
      state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND',
      omittedTerm: 'SECOND_ORDER_PERSPECTIVE_ACCELERATION',
      boundMilliarcsecondsPerKmPerSecond: 0,
      boundHorizonJulianEpoch: 2040,
      evidenceId: 'reference',
    },
    visualMagnitude: null,
    identity: { artifactId: 'reference', artifactVersion: '1', payloadSha256: '0'.repeat(64) },
    availability: 'AVAILABLE',
    approval: testApproval,
  };
}

function wrapped(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

describe('ScientificProfileV1 production versus PyERFA reference', () => {
  it('uses the hash-pinned reference output', () => {
    expect(createHash('sha256').update(outputText, 'utf8').digest('hex')).toBe(outputHash);
    expect(output.lineage).toBe('SHARED_SCIENTIFIC_LINEAGE_IMPLEMENTATION_VERIFICATION');
    expect(output.producer.sofaVersion).toBe('20231011');
    expect(output.cases).toHaveLength(input.stars.length * input.instants.length);
  });

  const residuals = { azimuth: 0, zenith: 0, composedZenith: 0, ut1: 0 };
  for (const instant of input.instants) {
    it(`reproduces the reference route at ${instant.utc}`, () => {
      const parsed = parseCanonicalUtc(instant.utc);
      if (!parsed.ok) throw new Error(parsed.detail);
      const validated = validateUtcInstant(parsed.value, leap, 'SYNTHETIC_TECHNICAL_FIXTURE');
      if (!validated.ok) throw new Error(validated.detail);
      expect(validated.value.taiMinusUtcSeconds).toBe(instant.taiMinusUtcSeconds);
      const tai = taiFromUtc(validated.value);
      const tt = ttFromTai(tai);
      const ut1 = ut1FromTai(tai, instant.ut1MinusUtcSeconds - instant.taiMinusUtcSeconds);
      const route = buildRouteContext(
        tt,
        ut1,
        instant.xpArcseconds * DAS2R,
        instant.ypArcseconds * DAS2R,
        observer,
      );
      if (!route.ok) throw new Error(route.detail);
      for (const row of input.stars) {
        const reference = output.cases.find(
          (c: { utc: string; starId: string }) => c.utc === instant.utc && c.starId === row.starId,
        );
        const result = executeStar(star(row), route.context);
        expect(result.kind).toBe('DIRECTION');
        if (result.kind !== 'DIRECTION') continue;
        const zenith = Math.PI / 2 - result.direction.altitudeRadians;
        const dZenith = Math.abs(zenith - reference.decomposed.zenithDistance);
        const dAzimuth = wrapped(
          result.direction.azimuthRadians as number,
          reference.decomposed.azimuth,
        );
        residuals.zenith = Math.max(residuals.zenith, dZenith);
        residuals.azimuth = Math.max(residuals.azimuth, dAzimuth);
        residuals.composedZenith = Math.max(
          residuals.composedZenith,
          Math.abs(zenith - reference.composed.zenithDistance),
        );
        residuals.ut1 = Math.max(residuals.ut1, Math.abs(ut1.part2 - reference.time.ut12) * 86400);
        expect(dZenith).toBeLessThanOrEqual(FIDELITY_BOUND_RADIANS);
        expect(dAzimuth).toBeLessThanOrEqual(FIDELITY_BOUND_RADIANS);
      }
    });
  }

  it('records the maximum residuals (measurement evidence, MEASURED_NO_ACCEPTANCE)', () => {
    console.info(
      `ProfileV1 vs PyERFA max residuals: azimuth ${residuals.azimuth.toExponential(2)} rad, zenith ${residuals.zenith.toExponential(2)} rad, vs composed atco13 ${residuals.composedZenith.toExponential(2)} rad, UT1 ${residuals.ut1.toExponential(2)} s`,
    );
    expect(Number.isFinite(residuals.zenith)).toBe(true);
  });
});
