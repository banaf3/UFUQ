import { describe, expect, it } from 'vitest';

import {
  earthOrientationAt,
  evaluateProfile,
  gregorianToModifiedJulianDay,
  isInsideSupportedDomain,
  lagrangeWeights,
  modifiedJulianDayToGregorian,
  parseCanonicalUtc,
  taiFromUtc,
  ttFromTai,
  utcQuasiJulianDate,
  validateUtcInstant,
  type ProfileEvaluation,
} from '../src/index.js';
import {
  REVIEW_REQUIRED_V1,
  syntheticArtifacts,
  syntheticDomain,
  syntheticEop,
  syntheticLeap,
  syntheticObserver,
  syntheticSamples,
} from './fixtures/synthetic-profile.js';

const scope = 'SYNTHETIC_TECHNICAL_FIXTURE' as const;

function instant(text: string) {
  const parsed = parseCanonicalUtc(text);
  if (!parsed.ok) throw new Error(parsed.detail);
  const validated = validateUtcInstant(parsed.value, syntheticLeap(), scope);
  if (!validated.ok) throw new Error(validated.detail);
  return validated.value;
}

describe('calendar', () => {
  it('converts Gregorian dates and MJD both ways', () => {
    expect(gregorianToModifiedJulianDay(2000, 1, 1)).toBe(51544);
    expect(gregorianToModifiedJulianDay(2025, 9, 2)).toBe(60920);
    expect(modifiedJulianDayToGregorian(60920)).toEqual({ year: 2025, month: 9, day: 2 });
    expect(modifiedJulianDayToGregorian(57753)).toEqual({ year: 2016, month: 12, day: 31 });
  });
});

describe('ScientificProfileV1 UTC grammar', () => {
  it.each([
    '2026-01-05T12:00:00',
    '2026-01-05T12:00:00.5Z',
    '2026-01-05T12:00:00+00:00',
    '2026-01-05t12:00:00z',
    '2026-02-30T00:00:00Z',
    '2026-01-05T24:00:00Z',
    '2026-01-05T12:00:60Z',
    '1767614400',
  ])('rejects %s', (text) => {
    const parsed = parseCanonicalUtc(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.outcome).toBe('TIMESTAMP_SYNTAX_INVALID');
  });

  it('accepts 23:59:60Z only on a confirmed positive leap date', () => {
    const leapDay = parseCanonicalUtc('2016-12-31T23:59:60Z');
    const ordinary = parseCanonicalUtc('2026-01-05T23:59:60Z');
    expect(leapDay.ok && ordinary.ok).toBe(true);
    if (!leapDay.ok || !ordinary.ok) return;
    const valid = validateUtcInstant(leapDay.value, syntheticLeap(), scope);
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.value.dayLengthSeconds).toBe(86401);
      expect(valid.value.taiMinusUtcSeconds).toBe(36);
      // 23:59:60 TAI is exactly one second before the next day's 00:00:00 TAI.
      const next = instant('2017-01-01T00:00:00Z');
      const delta = (taiFromUtc(next).part2 - taiFromUtc(valid.value).part2) * 86400;
      expect(delta).toBeCloseTo(1, 6);
    }
    const invalid = validateUtcInstant(ordinary.value, syntheticLeap(), scope);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.outcome).toBe('LEAP_SECOND_INSTANT_INVALID');
  });

  it('fails closed on missing, unverified, unapproved or expired leap data', () => {
    const parsed = parseCanonicalUtc('2026-01-05T12:00:00Z');
    if (!parsed.ok) throw new Error('parse');
    const outcome = (leap: Parameters<typeof validateUtcInstant>[1]) => {
      const result = validateUtcInstant(parsed.value, leap, scope);
      return result.ok ? 'OK' : result.outcome;
    };
    expect(outcome(undefined)).toBe('LEAP_VALIDATION_DATA_UNAVAILABLE');
    expect(outcome(syntheticLeap({ publisherIntegrity: 'MISMATCH' }))).toBe(
      'LEAP_VALIDATION_DATA_UNAVAILABLE',
    );
    expect(outcome(syntheticLeap({ approval: REVIEW_REQUIRED_V1 }))).toBe(
      'TIME_OR_EOP_STATE_NOT_APPROVED',
    );
    expect(outcome(syntheticLeap({ expiryMjd: 61000 }))).toBe('LEAP_VALIDATION_DATA_UNAVAILABLE');
    expect(outcome(syntheticLeap())).toBe('OK');
  });

  it('builds TAI and TT with the SOFA split convention', () => {
    const value = instant('2026-01-05T12:00:00Z');
    expect(utcQuasiJulianDate(value)).toMatchObject({ part1: 2400000.5, part2: 61045.5 });
    const tai = taiFromUtc(value);
    expect((tai.part2 - 61045.5) * 86400).toBeCloseTo(37, 6);
    expect((ttFromTai(tai).part2 - 61045.5) * 86400).toBeCloseTo(69.184, 6);
  });
});

describe('SupportedTimeDomain endpoints', () => {
  it('honours explicit inclusive and exclusive endpoints and adjacent seconds', () => {
    const domain = syntheticDomain();
    expect(isInsideSupportedDomain(instant('2026-01-01T23:59:59Z'), domain)).toBe(false);
    expect(isInsideSupportedDomain(instant('2026-01-02T00:00:00Z'), domain)).toBe(true);
    expect(isInsideSupportedDomain(instant('2026-01-08T23:59:59Z'), domain)).toBe(true);
    expect(isInsideSupportedDomain(instant('2026-01-09T00:00:00Z'), domain)).toBe(false);
  });
});

describe('four-point Lagrange EOP interpolation', () => {
  it('reproduces a cubic exactly and needs i-1..i+2 support', () => {
    const weights = lagrangeWeights([1, 2, 3, 4], 2.25);
    const cubic = (x: number) => x * x * x - 2 * x + 1;
    const value = weights.reduce((sum, w, k) => sum + w * cubic(k + 1), 0);
    expect(value).toBeCloseTo(cubic(2.25), 12);
  });

  it('interpolates continuous UT1-TAI and restores subdaily terms once', () => {
    const value = instant('2026-01-05T06:00:00Z');
    const tt = ttFromTai(taiFromUtc(value));
    const result = earthOrientationAt(
      value,
      tt,
      syntheticEop(syntheticSamples(61040, 12)),
      syntheticLeap(),
      scope,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const field = result.value.ut1MinusUtc;
    expect(field.interpolation.contributors.map((c) => c.mjdUtc)).toEqual([
      61044, 61045, 61046, 61047,
    ]);
    // Linear synthetic series: UT1-UTC daily value at day 5.25 is 50 - 0.5*5.25 ms.
    const daily = field.interpolation.dailyValue + 37;
    expect(daily).toBeCloseTo((50 - 0.5 * 5.25) / 1000, 12);
    expect(field.value).toBeCloseTo(
      daily + field.restoration.oceanTide + field.restoration.libration,
      12,
    );
    expect(Math.abs(field.restoration.oceanTide)).toBeGreaterThan(0);
  });

  it('fails closed on insufficient support, gaps, non-final quality and approval', () => {
    const at = (text: string, samples = syntheticSamples(61040, 12), overrides = {}) => {
      const value = instant(text);
      const tt = ttFromTai(taiFromUtc(value));
      const result = earthOrientationAt(
        value,
        tt,
        syntheticEop(samples, overrides),
        syntheticLeap(),
        scope,
      );
      return result.ok ? 'OK' : `${result.outcome}:${result.detail}`;
    };
    expect(at('2025-12-31T12:00:00Z')).toMatch(/EOP_FIELD_UNAVAILABLE.*INSUFFICIENT/);
    expect(at('2026-01-11T00:00:00Z')).toMatch(/EOP_FIELD_UNAVAILABLE.*INSUFFICIENT/);
    expect(at('2026-01-12T00:00:00Z')).toMatch(/EOP_FIELD_UNAVAILABLE.*OUT_OF_RANGE/);
    const gapped = syntheticSamples(61040, 12).filter((sample) => sample.mjdUtc !== 61046);
    expect(at('2026-01-05T06:00:00Z', gapped)).toMatch(/EOP_FIELD_UNAVAILABLE.*GAP/);
    const preliminary = syntheticSamples(61040, 12).map((sample) =>
      sample.mjdUtc === 61046
        ? {
            ...sample,
            fields: {
              ...sample.fields,
              XP: { ...sample.fields.XP, quality: 'PRELIMINARY' as const },
            },
          }
        : sample,
    );
    expect(at('2026-01-05T06:00:00Z', preliminary)).toMatch(/TIME_OR_EOP_STATE_NOT_APPROVED/);
    const policy = { approval: REVIEW_REQUIRED_V1, publisherValidity: 'NOT_DECLARED' as const };
    expect(
      at('2026-01-05T06:00:00Z', undefined, {
        fieldPolicies: { UT1_MINUS_UTC: policy, XP: policy, YP: policy },
      }),
    ).toMatch(/TIME_OR_EOP_STATE_NOT_APPROVED/);
  });
});

describe('profile evaluation precedence', () => {
  const request = {
    executionScope: scope,
    utc: '2026-01-05T14:00:00Z',
    observerPresetId: 'synthetic-observer-equator',
    starIds: ['synthetic-star-north', 'synthetic-star-south', 'missing-star'],
  };

  it('returns pending-validation geometric directions with attached classifications', () => {
    const result = evaluateProfile(request, syntheticArtifacts());
    expect(result.outcome).toBe('GEOMETRIC_RESULT_PENDING_VALIDATION');
    const stars = result.stars;
    const north = stars.find((s) => s.starId === 'synthetic-star-north');
    expect(north?.kind).toBe('DIRECTION');
    if (north?.kind === 'DIRECTION') {
      expect(north.direction.scientificValidationState).toBe('GEOMETRIC_RESULT_PENDING_VALIDATION');
      expect(north.direction.optionalStages.refraction).toBe('REFRACTION_NOT_REQUESTED');
      const [e, n, u] = north.direction.enu;
      expect(Math.hypot(e, n, u)).toBeCloseTo(1, 12);
      // A star near the north celestial pole seen from 3.5 N sits near azimuth 0, altitude ~3.5.
      expect((north.direction.altitudeRadians * 180) / Math.PI).toBeGreaterThan(2);
      expect((north.direction.altitudeRadians * 180) / Math.PI).toBeLessThan(5.5);
    }
    expect(stars.find((s) => s.starId === 'missing-star')).toMatchObject({
      kind: 'NON_RESULT',
      outcome: 'REQUIRED_ARTIFACT_UNAVAILABLE',
      stage: 6,
    });
  });

  it('keeps below-horizon results as valid directions', () => {
    const result = evaluateProfile(request, syntheticArtifacts());
    const south = result.stars.find((s) => s.starId === 'synthetic-star-south');
    expect(south?.kind).toBe('DIRECTION');
    if (south?.kind === 'DIRECTION') {
      const below = south.direction.altitudeRadians < 0;
      expect(south.direction.horizonClassification).toBe(
        below ? 'BELOW_GEOMETRIC_HORIZON' : 'NOT_BELOW_GEOMETRIC_HORIZON',
      );
    }
  });

  it('orders failures deterministically', () => {
    const outcome = (result: ProfileEvaluation) => [
      result.outcome,
      'stage' in result ? result.stage : 0,
    ];
    expect(outcome(evaluateProfile({ ...request, utc: 'now' }, syntheticArtifacts()))).toEqual([
      'TIMESTAMP_SYNTAX_INVALID',
      1,
    ]);
    expect(outcome(evaluateProfile({ ...request, utc: undefined }, syntheticArtifacts()))).toEqual([
      'REQUIRED_INPUT_MISSING',
      2,
    ]);
    expect(
      outcome(
        evaluateProfile(
          request,
          syntheticArtifacts({ leap: syntheticLeap({ approval: REVIEW_REQUIRED_V1 }) }),
        ),
      ),
    ).toEqual(['TIME_OR_EOP_STATE_NOT_APPROVED', 3]);
    expect(
      outcome(evaluateProfile({ ...request, utc: '2026-02-05T14:00:00Z' }, syntheticArtifacts())),
    ).toEqual(['TIME_OUTSIDE_SUPPORTED_DOMAIN', 4]);
    expect(
      outcome(
        evaluateProfile(
          { ...request, observerPresetId: 'umpsa-pekan-faculty-of-computing' },
          syntheticArtifacts(),
        ),
      ),
    ).toEqual(['UNSUPPORTED_PROFILE_DOMAIN', 5]);
    const unapprovedObserver = syntheticObserver({ approval: REVIEW_REQUIRED_V1 });
    expect(
      outcome(
        evaluateProfile(
          request,
          syntheticArtifacts({
            observers: new Map([[unapprovedObserver.presetId, unapprovedObserver]]),
          }),
        ),
      ),
    ).toEqual(['REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED', 5]);
    const { eop: omittedEop, ...withoutEop } = syntheticArtifacts();
    expect(omittedEop).toBeDefined();
    const missingEop = evaluateProfile(request, withoutEop);
    expect(outcome(missingEop)).toEqual(['REQUIRED_ARTIFACT_UNAVAILABLE', 7]);
    // A later global failure keeps the earlier per-star stage-6 states.
    expect(missingEop.stars.find((s) => s.starId === 'missing-star')).toMatchObject({ stage: 6 });
    expect(missingEop.stars.find((s) => s.starId === 'synthetic-star-north')?.kind).toBe(
      'NOT_EXECUTED',
    );
  });

  it('never accepts a synthetic approval for ScientificProfileV1 execution', () => {
    const result = evaluateProfile(
      { ...request, executionScope: 'SCIENTIFIC_PROFILE_V1' },
      syntheticArtifacts(),
    );
    expect(result.outcome).toBe('TIME_OR_EOP_STATE_NOT_APPROVED');
  });
});

describe('review-preview scope', () => {
  const reviewRequiredArtifacts = (state: 'REVIEW_REQUIRED' | 'NOT_APPROVED') => {
    const approval = { ...REVIEW_REQUIRED_V1, state };
    const base = syntheticArtifacts();
    const observer = syntheticObserver({ presetId: 'umpsa-pekan-faculty-of-computing', approval });
    const policy = { approval, publisherValidity: 'NOT_DECLARED' as const };
    return syntheticArtifacts({
      leap: syntheticLeap({ approval }),
      domain: syntheticDomain({
        profileId: 'ScientificProfileV1',
        executionScope: 'SCIENTIFIC_PROFILE_V1',
        approval,
      }),
      eop: syntheticEop(syntheticSamples(61040, 12), {
        fieldPolicies: { UT1_MINUS_UTC: policy, XP: policy, YP: policy },
      }),
      observers: new Map([[observer.presetId, observer]]),
      stars: new Map([...base.stars].map(([id, star]) => [id, { ...star, approval }])),
    });
  };
  const request = {
    utc: '2026-01-05T14:00:00Z',
    observerPresetId: 'umpsa-pekan-faculty-of-computing',
    starIds: ['synthetic-star-north'],
  };

  it('runs REVIEW_REQUIRED ProfileV1 inputs only under the labelled preview scope', () => {
    const preview = evaluateProfile(
      { ...request, executionScope: 'REVIEW_PREVIEW' },
      reviewRequiredArtifacts('REVIEW_REQUIRED'),
    );
    expect(preview.outcome).toBe('GEOMETRIC_RESULT_PENDING_VALIDATION');
    expect(preview.profileId).toBe('ScientificProfileV1ReviewPreview');
    const strict = evaluateProfile(
      { ...request, executionScope: 'SCIENTIFIC_PROFILE_V1' },
      reviewRequiredArtifacts('REVIEW_REQUIRED'),
    );
    expect(strict.outcome).toBe('TIME_OR_EOP_STATE_NOT_APPROVED');
  });

  it('never accepts NOT_APPROVED inputs, even in preview', () => {
    const preview = evaluateProfile(
      { ...request, executionScope: 'REVIEW_PREVIEW' },
      reviewRequiredArtifacts('NOT_APPROVED'),
    );
    expect(preview.outcome).toBe('TIME_OR_EOP_STATE_NOT_APPROVED');
  });
});
