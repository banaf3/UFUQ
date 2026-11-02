// Builds the tracked ScientificProfileV1 reference-comparison INPUT fixture. It copies
// data only (route-star rows and the observer candidate from data/generated) and adds
// explicitly SYNTHETIC instantaneous Earth-orientation inputs, so the fixture carries no
// IERS Bulletin B values. It imports no production or reference code.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const stars = read('data/generated/route-stars-hipparcos1997-v1.json');
const observer = read('data/generated/observer-umpsa-pekan-v1.json');

// canonical UTC, TAI-UTC (s), synthetic UT1-UTC (s), synthetic xp, yp (arcsec)
const INSTANTS = [
  ['2025-09-03T00:00:00Z', 37, 0.0866, 0.2347, 0.3883],
  ['2025-11-15T13:00:00Z', 37, 0.0852, 0.1534, 0.3021],
  ['2026-01-10T12:00:00Z', 37, 0.0721, 0.1102, 0.271],
  ['2026-02-28T23:59:59Z', 37, 0.0635, 0.0954, 0.2551],
  ['2026-04-15T14:00:00Z', 37, 0.0434, 0.1451, 0.2603],
  ['2026-05-30T23:59:59Z', 37, 0.0297, 0.1802, 0.301],
  ['2016-12-31T23:59:60Z', 36, -0.4089, 0.0611, 0.2827],
  ['2017-01-01T00:00:00Z', 37, 0.5911, 0.0611, 0.2827],
];

const fixture = {
  fixtureType: 'UFUQ_PROFILE_V1_REFERENCE_INPUT',
  schemaVersion: 1,
  purpose:
    'POST_IMPLEMENTATION shared-lineage implementation verification of the ScientificProfileV1 geometric route (TypeScript SOFA-derived subset versus PyERFA). Not scientific acceptance and not a tolerance.',
  earthOrientationInputs:
    'SYNTHETIC_TECHNICAL_INPUT: invented instantaneous UT1-UTC, xp and yp values of realistic magnitude. They are route inputs only, not IERS data.',
  starSource: {
    artifactId: stars.artifactId,
    payloadSha256: stars.payloadSha256,
    credit:
      'ESA (1997), The Hipparcos and Tycho Catalogues, ESA SP-1200. Credit: ESA (CC BY-NC 3.0 IGO).',
  },
  observerSource: { artifactId: observer.artifactId, payloadSha256: observer.payloadSha256 },
  sourceEpoch: stars.payload.epoch,
  observer: {
    geodeticLatitudeDegrees: observer.payload.geodeticLatitudeDegrees,
    geodeticLongitudeDegrees: observer.payload.geodeticLongitudeDegrees,
    ellipsoidalHeightMetres: observer.payload.height.valueMetres,
    ellipsoid: 'WGS 84',
  },
  stars: stars.payload.stars.map((star) => ({
    starId: star.starId,
    rightAscensionRadians: star.normalized.rightAscensionRadians,
    declinationRadians: star.normalized.declinationRadians,
    muAlphaStarMasPerYear: star.normalized.muAlphaStarMasPerYear,
    muDeltaMasPerYear: star.normalized.muDeltaMasPerYear,
    parallaxMas: star.normalized.parallaxMas,
    radialVelocityState: star.radialVelocity.state,
  })),
  instants: INSTANTS.map(([utc, taiMinusUtc, ut1MinusUtc, xpArcsec, ypArcsec]) => ({
    utc,
    taiMinusUtcSeconds: taiMinusUtc,
    ut1MinusUtcSeconds: ut1MinusUtc,
    xpArcseconds: xpArcsec,
    ypArcseconds: ypArcsec,
  })),
};

const output = join(root, 'tools/astronomy-reference/fixtures/profile-v1-reference-input.v1.json');
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(
  `Wrote ${fixture.stars.length} stars x ${fixture.instants.length} instants to ${output}.`,
);
