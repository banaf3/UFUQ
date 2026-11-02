// Visibly synthetic technical fixtures for astronomy-core tests (IMP-011/IMP-012). They
// carry the SYNTHETIC_TECHNICAL_FIXTURE scope and never authorize real data.
import type {
  ApprovedLeapState,
  CatalogueStarState,
  EopBundle,
  EopDailySample,
  ObserverPreset,
  ProfileArtifacts,
  ScientificApproval,
  SupportedTimeDomain,
} from '../../src/index.js';

export const SYNTHETIC_APPROVAL: ScientificApproval = {
  state: 'APPROVED',
  scope: 'SYNTHETIC_TECHNICAL_FIXTURE',
  reviewer: 'NOT_APPLICABLE_SYNTHETIC',
  decisionDate: null,
  decisionReference: 'IMP-011/IMP-012 synthetic technical fixture',
};

export const REVIEW_REQUIRED_V1: ScientificApproval = {
  state: 'REVIEW_REQUIRED',
  scope: 'SCIENTIFIC_PROFILE_V1',
  reviewer: null,
  decisionDate: null,
  decisionReference: null,
};

const identity = (artifactId: string) => ({
  artifactId,
  artifactVersion: 'synthetic-1',
  payloadSha256: '0'.repeat(64),
});

/** Leap transitions 1972-2017 as published (facts; used here as a synthetic fixture). */
const TAI_UTC_STEPS: readonly (readonly [number, number])[] = [
  [41317, 10],
  [41499, 11],
  [41683, 12],
  [42048, 13],
  [42413, 14],
  [42778, 15],
  [43144, 16],
  [43509, 17],
  [43874, 18],
  [44239, 19],
  [44786, 20],
  [45151, 21],
  [45516, 22],
  [46247, 23],
  [47161, 24],
  [47892, 25],
  [48257, 26],
  [48804, 27],
  [49169, 28],
  [49534, 29],
  [50083, 30],
  [50630, 31],
  [51179, 32],
  [53736, 33],
  [54832, 34],
  [56109, 35],
  [57204, 36],
  [57754, 37],
];

export function syntheticLeap(overrides: Partial<ApprovedLeapState> = {}): ApprovedLeapState {
  return {
    identity: identity('synthetic-leap'),
    availability: 'AVAILABLE',
    publisherIntegrity: 'VERIFIED',
    bulletinCConsistency: 'CONSISTENT',
    expiryMjd: 61584,
    transitions: TAI_UTC_STEPS.map(([effectiveMjd, taiMinusUtcSeconds]) => ({
      effectiveMjd,
      taiMinusUtcSeconds,
    })),
    approval: SYNTHETIC_APPROVAL,
    ...overrides,
  };
}

/** Synthetic smooth daily EOP samples (clearly not IERS values). */
export function syntheticSamples(firstMjd: number, count: number): EopDailySample[] {
  return Array.from({ length: count }, (_, k) => {
    const mjd = firstMjd + k;
    return {
      sampleId: `synthetic#${mjd}`,
      mjdUtc: mjd,
      seriesId: 'synthetic-series',
      fields: {
        UT1_MINUS_UTC: {
          nativeValue: 50 - 0.5 * k,
          quality: 'FINAL',
          uncertainty: { value: 0.01, unit: 'MILLISECOND', meaning: 'synthetic' },
        },
        XP: { nativeValue: 100 + 0.2 * k, quality: 'FINAL', uncertainty: null },
        YP: { nativeValue: 300 - 0.3 * k, quality: 'FINAL', uncertainty: null },
      },
    };
  });
}

export function syntheticEop(
  samples: EopDailySample[],
  overrides: Partial<EopBundle> = {},
): EopBundle {
  const policy = { approval: SYNTHETIC_APPROVAL, publisherValidity: 'NOT_DECLARED' as const };
  return {
    identity: identity('synthetic-eop'),
    availability: 'AVAILABLE',
    sourceProductId: 'SYNTHETIC',
    coherentSeriesId: 'synthetic-series',
    restorationConfigurationId: 'IERS2010_V1_0_0_SUBDAILY_V1',
    fieldPolicies: { UT1_MINUS_UTC: policy, XP: policy, YP: policy },
    samples,
    ...overrides,
  };
}

export function syntheticDomain(overrides: Partial<SupportedTimeDomain> = {}): SupportedTimeDomain {
  return {
    profileId: 'SyntheticTechnicalProfileV1',
    executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
    domainVersion: 'synthetic-domain-1',
    earliest: { canonicalUtc: '2026-01-02T00:00:00Z', boundary: 'INCLUSIVE' },
    latest: { canonicalUtc: '2026-01-09T00:00:00Z', boundary: 'EXCLUSIVE' },
    inputResolution: 'WHOLE_SECOND',
    contributingDomainIdentities: ['synthetic'],
    requiredLeapAndEopPolicyIdentities: ['synthetic'],
    requiredArtifactManifestIdentities: ['synthetic'],
    requiredFieldCoverage: ['UT1_MINUS_UTC', 'XP', 'YP'],
    interpolationSupportRequirements: 'LAGRANGE_FOUR_POINT_V1 full support',
    derivationMethodAndVersion: 'synthetic',
    approval: SYNTHETIC_APPROVAL,
    ...overrides,
  };
}

export function syntheticObserver(overrides: Partial<ObserverPreset> = {}): ObserverPreset {
  return {
    schemaVersion: 1,
    presetId: 'synthetic-observer-equator',
    displayLabel: 'Synthetic observer',
    siteIdentity: 'Synthetic technical site',
    referencePointDescription: 'Synthetic point',
    geodeticLatitudeDegrees: 3.5,
    geodeticLongitudeDegrees: 103.4,
    referenceSystem: { kind: 'GEODETIC_DATUM', identifier: 'WGS 84', realization: null },
    referenceEllipsoid: {
      ellipsoidId: 'WGS84',
      equatorialRadiusMetres: 6378137,
      inverseFlattening: 298.257223563,
      source: 'synthetic',
    },
    coordinateReferenceEpoch: { state: 'NOT_REQUIRED', basis: 'synthetic' },
    height: { kind: 'ELLIPSOIDAL', valueMetres: 10, ellipsoidId: 'WGS84' },
    coordinateAccuracy: {
      horizontal: { state: 'UNKNOWN_UNBOUNDED', reason: 'synthetic' },
      vertical: { state: 'UNKNOWN_UNBOUNDED', reason: 'synthetic' },
    },
    provenance: ['synthetic'],
    dataVersionId: 'synthetic-1',
    identity: identity('synthetic-observer'),
    availability: 'AVAILABLE',
    approval: SYNTHETIC_APPROVAL,
    ...overrides,
  };
}

export function syntheticStar(starId: string, raDeg: number, decDeg: number): CatalogueStarState {
  return {
    starId,
    sourceRecordId: `synthetic:${starId}`,
    rightAscensionRadians: (raDeg * Math.PI) / 180,
    declinationRadians: (decDeg * Math.PI) / 180,
    epoch: {
      nativeNotation: 'J1991.25(TT)',
      scale: 'TT',
      julianDate: {
        scale: 'TT',
        splitConvention: 'MJD_ZERO_PLUS_OFFSET',
        part1: 2400000.5,
        part2: 48348.5625,
      },
    },
    properMotion: {
      muAlphaStarMasPerYear: 10,
      muDeltaMasPerYear: -5,
      durationUnit: 'JULIAN_YEAR',
      derivativeScale: 'TT',
    },
    parallax: { state: 'APPROVED_USABLE_DISTANCE', parallaxMas: 20 },
    radialVelocity: {
      state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND',
      omittedTerm: 'SECOND_ORDER_PERSPECTIVE_ACCELERATION',
      boundMilliarcsecondsPerKmPerSecond: 0.001,
      boundHorizonJulianEpoch: 2040,
      evidenceId: 'synthetic',
    },
    visualMagnitude: 2,
    identity: identity(`synthetic-star-${starId}`),
    availability: 'AVAILABLE',
    approval: SYNTHETIC_APPROVAL,
  };
}

export function syntheticArtifacts(overrides: Partial<ProfileArtifacts> = {}): ProfileArtifacts {
  const observer = syntheticObserver();
  const stars = [
    syntheticStar('synthetic-star-north', 37.95, 89.26),
    syntheticStar('synthetic-star-south', 100, -60),
  ];
  return {
    leap: syntheticLeap(),
    domain: syntheticDomain(),
    eop: syntheticEop(syntheticSamples(61040, 12)),
    observers: new Map([[observer.presetId, observer]]),
    stars: new Map(stars.map((star) => [star.starId, star])),
    ...overrides,
  };
}
