import { describe, expect, it } from 'vitest';

import {
  buildRouteContext,
  type DisplayStarInput,
  evaluateProfile,
  executeDisplayStar,
  executeStar,
  julianEpochToTwoPartTt,
  parseCanonicalUtc,
  taiFromUtc,
  ttFromTai,
  ut1FromTai,
  validateUtcInstant,
} from '../src/index.js';
import {
  REVIEW_REQUIRED_V1,
  SYNTHETIC_APPROVAL,
  syntheticArtifacts,
  syntheticLeap,
  syntheticObserver,
  syntheticStar,
} from './fixtures/synthetic-profile.js';

const DEG = Math.PI / 180;
const epoch = julianEpochToTwoPartTt(1991.25);

function context() {
  const parsed = parseCanonicalUtc('2026-03-20T12:00:00Z');
  if (!parsed.ok) throw new Error('utc');
  const instant = validateUtcInstant(parsed.value, syntheticLeap(), 'SYNTHETIC_TECHNICAL_FIXTURE');
  if (!instant.ok) throw new Error('leap');
  const tai = taiFromUtc(instant.value);
  const route = buildRouteContext(ttFromTai(tai), ut1FromTai(tai, 37.1), 0, 0, syntheticObserver());
  if (!route.ok) throw new Error('route');
  return route.context;
}

const display = (change: Partial<DisplayStarInput> = {}): DisplayStarInput => ({
  starId: 'hip-1',
  astrometry: 'FULL_SOLUTION',
  rightAscensionRadians: 40 * DEG,
  declinationRadians: 70 * DEG,
  parallaxMas: 20,
  muAlphaStarMasPerYear: 10,
  muDeltaMasPerYear: -5,
  visualMagnitude: 4.2,
  colorIndexBV: 0.6,
  ...change,
});

describe('SkyDisplayPolicyV1 (display-only background field)', () => {
  const ctx = context();

  it('matches the ScientificProfileV1 route for an ordinary star', () => {
    const star = syntheticStar('route', 40, 70);
    const route = executeStar(star, ctx);
    if (route.kind !== 'DIRECTION') throw new Error('route failed');
    const shown = executeDisplayStar(
      display({
        rightAscensionRadians: star.rightAscensionRadians,
        declinationRadians: star.declinationRadians,
        parallaxMas: star.parallax.parallaxMas,
        muAlphaStarMasPerYear: star.properMotion.muAlphaStarMasPerYear,
        muDeltaMasPerYear: star.properMotion.muDeltaMasPerYear,
      }),
      star.epoch.julianDate,
      ctx,
    );
    shown?.enu.forEach((value, i) =>
      expect(value).toBeCloseTo(route.direction.enu[i] as number, 12),
    );
    expect(shown?.flags).toEqual([]);
  });

  it('accepts SOFA minimum-parallax override (status 1) and flags it', () => {
    const shown = executeDisplayStar(display({ parallaxMas: -1.2 }), epoch, ctx);
    expect(shown?.flags).toEqual(['SOFA_MINIMUM_PARALLAX_OVERRIDE']);
    expect(Math.hypot(...(shown?.enu ?? [0, 0, 0]))).toBeCloseTo(1, 12);
  });

  it('flags a coarse position without an astrometric solution', () => {
    const shown = executeDisplayStar(
      display({
        astrometry: 'COARSE_POSITION_NO_SOLUTION',
        parallaxMas: 0,
        muAlphaStarMasPerYear: 0,
        muDeltaMasPerYear: 0,
      }),
      epoch,
      ctx,
    );
    expect(shown?.flags).toEqual(['COARSE_POSITION_NO_SOLUTION', 'SOFA_MINIMUM_PARALLAX_OVERRIDE']);
  });

  it('refuses non-finite input and a pole', () => {
    expect(executeDisplayStar(display({ visualMagnitude: Number.NaN }), epoch, ctx)).toBeNull();
    expect(executeDisplayStar(display({ declinationRadians: Math.PI / 2 }), epoch, ctx)).toBeNull();
  });

  it('runs only after every profile gate and only for an accepted field', () => {
    const field = {
      identity: { artifactId: 'field', artifactVersion: '1', payloadSha256: 'x' },
      approval: SYNTHETIC_APPROVAL,
      epoch,
      stars: [display(), display({ starId: 'hip-2', parallaxMas: -3 })],
    };
    const accepted = evaluateProfile(
      {
        executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
        utc: '2026-01-05T14:00:00Z',
        observerPresetId: 'synthetic-observer-equator',
        starIds: ['synthetic-star-north'],
        includeDisplayField: true,
      },
      syntheticArtifacts({ displayField: field }),
    );
    if (accepted.outcome !== 'GEOMETRIC_RESULT_PENDING_VALIDATION')
      throw new Error(accepted.outcome);
    expect(accepted.display).toMatchObject({ status: 'ACCEPTED', omittedStarIds: [] });
    expect(accepted.display?.status === 'ACCEPTED' && accepted.display.stars.length).toBe(2);

    const unreviewed = evaluateProfile(
      {
        executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
        utc: '2026-01-05T14:00:00Z',
        observerPresetId: 'synthetic-observer-equator',
        starIds: ['synthetic-star-north'],
        includeDisplayField: true,
      },
      syntheticArtifacts({ displayField: { ...field, approval: REVIEW_REQUIRED_V1 } }),
    );
    if (unreviewed.outcome !== 'GEOMETRIC_RESULT_PENDING_VALIDATION')
      throw new Error(unreviewed.outcome);
    expect(unreviewed.display?.status).toBe('NOT_ACCEPTED');

    const withoutField = evaluateProfile(
      {
        executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
        utc: '2026-01-05T14:00:00Z',
        observerPresetId: 'synthetic-observer-equator',
        starIds: ['synthetic-star-north'],
      },
      syntheticArtifacts({ displayField: field }),
    );
    expect('display' in withoutField).toBe(false);
  });
});
