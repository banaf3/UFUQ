/**
 * ScientificProfileV1 evaluation with the normative semantic precedence
 * (PHASE1_SCIENTIFIC_PROFILE_V1.md, "Normative scientific outcomes and precedence").
 * Pure: every artifact is supplied explicitly; no I/O, clock, or ambient table.
 */
import { DJ00, DJM0, DMAS2R } from '../astrometry/constants.js';
import {
  type ObserverAstrometryContext,
  cirsToGeometricHorizontal,
  icrsToCirs,
  observerAstrometryContext,
} from '../astrometry/astrometry-context.js';
import {
  earthPositionVelocity,
  earthRotationAngle,
  tioLocator,
} from '../astrometry/earth-rotation.js';
import {
  biasPrecessionNutationMatrix,
  cioLocatorIau2006,
  cipCoordinatesFromMatrix,
} from '../astrometry/precession-nutation.js';
import { propagateStarSafely } from '../astrometry/space-motion.js';
import type { Vec3 } from '../astrometry/vector.js';
import {
  type CatalogueStarState,
  sourceEpochAsTdb,
  starEligibility,
} from '../catalogue/catalogue-star.js';
import { approvalScopeFor, type ExecutionScope, isApprovedFor } from '../common/provenance.js';
import { type EarthOrientationInput, type EopBundle, earthOrientationAt } from '../eop/eop.js';
import { type ObserverPreset, validateObserverPreset } from '../observer/observer-preset.js';
import { isInsideSupportedDomain, type SupportedTimeDomain } from '../time/supported-domain.js';
import {
  type ApprovedLeapState,
  parseCanonicalUtc,
  taiFromUtc,
  ttFromTai,
  type TwoPartJulianDate,
  ut1FromTai,
  utcQuasiJulianDate,
  validateUtcInstant,
} from '../time/utc.js';

export const SCIENTIFIC_PROFILE_V1_ID = 'ScientificProfileV1';
export const SYNTHETIC_TECHNICAL_PROFILE_ID = 'SyntheticTechnicalProfileV1';
export const REVIEW_PREVIEW_PROFILE_ID = 'ScientificProfileV1ReviewPreview';
export const V1_OBSERVER_PRESET_ID = 'umpsa-pekan-faculty-of-computing';

/** Identity of this implementation of the normative route. */
export const PROFILE_V1_ALGORITHM_IDENTITY = {
  algorithmId: 'UFUQ_PROFILE_V1_GEOMETRIC_ROUTE',
  algorithmVersion: '1.0.0',
  derivedFrom: 'IAU SOFA ANSI C 2023-10-11 (sofa_c-20231011.zip)',
  model: 'IAU 2006 precession + IAU 2000A nutation (CIO based); epv00 simplified VSOP2000',
  restoration: 'IERS Conventions (2010) v1.0.0 ORTHO_EOP/CNMTX, PMSDNUT2 IBAND=1, UTLIBR',
  interpolation: 'LAGRANGE_FOUR_POINT_V1 via continuous UT1-TAI',
  sourceEpochAdapter: 'CATALOGUE_TT_EPOCH_TO_TDB_GEOCENTRIC_V1',
  derivativeScaleAdapter: 'TT_RATE_EQUALS_TDB_RATE_IAU2006_B3',
} as const;

export type GlobalFailureOutcome =
  | 'INVALID_INPUT'
  | 'REQUIRED_INPUT_MISSING'
  | 'REQUIRED_ARTIFACT_UNAVAILABLE'
  | 'UNSUPPORTED_PROFILE_DOMAIN'
  | 'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED'
  | 'SCIENTIFIC_EXECUTION_FAILURE'
  | 'TIMESTAMP_SYNTAX_INVALID'
  | 'LEAP_SECOND_INSTANT_INVALID'
  | 'LEAP_VALIDATION_DATA_UNAVAILABLE'
  | 'REQUIRED_TIME_SCALE_UNAVAILABLE'
  | 'EOP_FIELD_UNAVAILABLE'
  | 'TIME_OUTSIDE_SUPPORTED_DOMAIN'
  | 'TIME_OR_EOP_STATE_NOT_APPROVED';

export type StarFailureOutcome =
  | 'REQUIRED_ARTIFACT_UNAVAILABLE'
  | 'UNSUPPORTED_PROFILE_DOMAIN'
  | 'INVALID_INPUT'
  | 'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED'
  | 'SCIENTIFIC_EXECUTION_FAILURE';

export interface GeometricHorizontalDirection {
  readonly starId: string;
  readonly sourceRecordId: string;
  readonly altitudeRadians: number;
  readonly azimuthRadians: number | null;
  readonly azimuthState: 'DEFINED' | 'UNDEFINED_SINGULAR';
  /** East, north, up unit vector. */
  readonly enu: Vec3;
  readonly horizonClassification: 'BELOW_GEOMETRIC_HORIZON' | 'NOT_BELOW_GEOMETRIC_HORIZON';
  readonly scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION';
  readonly optionalStages: {
    readonly refraction: 'REFRACTION_NOT_REQUESTED';
    readonly visibility: 'PROFILE_EXCLUDED_NOT_REQUESTED';
  };
  readonly statuses: {
    readonly propagation: number;
  };
  readonly radialVelocityState: CatalogueStarState['radialVelocity']['state'];
  readonly visualMagnitude: number | null;
}

export type StarResult =
  | {
      readonly kind: 'DIRECTION';
      readonly starId: string;
      readonly direction: GeometricHorizontalDirection;
    }
  | {
      readonly kind: 'NOT_EXECUTED';
      readonly starId: string;
      readonly reason: 'ELIGIBLE_BUT_GLOBAL_FAILURE';
    }
  | {
      readonly kind: 'NON_RESULT';
      readonly starId: string;
      readonly outcome: StarFailureOutcome;
      readonly stage: number;
      readonly detail: string;
    };

export interface ProfileArtifacts {
  readonly leap?: ApprovedLeapState;
  readonly domain?: SupportedTimeDomain;
  readonly eop?: EopBundle;
  readonly observers: ReadonlyMap<string, ObserverPreset>;
  readonly stars: ReadonlyMap<string, CatalogueStarState>;
}

export interface ProfileRequest {
  readonly executionScope: ExecutionScope;
  readonly utc?: unknown;
  readonly observerPresetId?: unknown;
  readonly starIds?: unknown;
}

export interface TimeEvidence {
  readonly utc: string;
  readonly utcQuasiJd: TwoPartJulianDate<'UTC_QUASI_JD'>;
  readonly tai: TwoPartJulianDate<'TAI'>;
  readonly tt: TwoPartJulianDate<'TT'>;
  readonly ut1: TwoPartJulianDate<'UT1'>;
  readonly taiMinusUtcSeconds: number;
}

export type ProfileEvaluation =
  | {
      readonly outcome: 'GEOMETRIC_RESULT_PENDING_VALIDATION';
      readonly profileId: string;
      readonly executionScope: ExecutionScope;
      readonly algorithm: typeof PROFILE_V1_ALGORITHM_IDENTITY;
      readonly observerPresetId: string;
      readonly time: TimeEvidence;
      readonly earthOrientation: EarthOrientationInput;
      readonly artifactIdentities: readonly string[];
      readonly stars: readonly StarResult[];
    }
  | {
      readonly outcome: GlobalFailureOutcome;
      readonly profileId: string;
      readonly executionScope: ExecutionScope;
      readonly stage: number;
      readonly detail: string;
      /** Stage-6 per-star states already established before a later global failure. */
      readonly stars: readonly StarResult[];
    };

export function profileIdFor(scope: ExecutionScope): string {
  if (scope === 'SCIENTIFIC_PROFILE_V1') return SCIENTIFIC_PROFILE_V1_ID;
  return scope === 'REVIEW_PREVIEW' ? REVIEW_PREVIEW_PROFILE_ID : SYNTHETIC_TECHNICAL_PROFILE_ID;
}

/** The profile whose activated domain a scope must use (preview reuses ProfileV1). */
function domainProfileIdFor(scope: ExecutionScope): string {
  return scope === 'SYNTHETIC_TECHNICAL_FIXTURE'
    ? SYNTHETIC_TECHNICAL_PROFILE_ID
    : SCIENTIFIC_PROFILE_V1_ID;
}

function presetAllowed(scope: ExecutionScope, presetId: string): boolean {
  return scope === 'SYNTHETIC_TECHNICAL_FIXTURE'
    ? presetId.startsWith('synthetic-')
    : presetId === V1_OBSERVER_PRESET_ID;
}

/** Evaluate geometric horizontal directions for the requested stars under the profile. */
export function evaluateProfile(
  request: ProfileRequest,
  artifacts: ProfileArtifacts,
): ProfileEvaluation {
  const scope = request.executionScope;
  const profileId = profileIdFor(scope);
  let starResults: StarResult[] = [];
  const fail = (
    outcome: GlobalFailureOutcome,
    stage: number,
    detail: string,
  ): ProfileEvaluation => ({
    outcome,
    profileId,
    executionScope: scope,
    stage,
    detail,
    stars: starResults,
  });

  // Stage 1: structure of supplied values.
  let supplied;
  if (request.utc !== undefined) {
    const parsed = parseCanonicalUtc(request.utc);
    if (!parsed.ok) return fail(parsed.outcome, 1, parsed.detail);
    supplied = parsed.value;
  }
  if (request.observerPresetId !== undefined && typeof request.observerPresetId !== 'string') {
    return fail('INVALID_INPUT', 1, 'observerPresetId must be text.');
  }
  let starIds: string[] | undefined;
  if (request.starIds !== undefined) {
    if (
      !Array.isArray(request.starIds) ||
      request.starIds.length === 0 ||
      !request.starIds.every((id) => typeof id === 'string' && id.length > 0) ||
      new Set(request.starIds).size !== request.starIds.length
    ) {
      return fail('INVALID_INPUT', 1, 'starIds must be a non-empty list of unique identifiers.');
    }
    starIds = request.starIds as string[];
  }

  // Stage 2: missing required inputs.
  if (supplied === undefined) return fail('REQUIRED_INPUT_MISSING', 2, 'utc is required.');
  if (request.observerPresetId === undefined) {
    return fail('REQUIRED_INPUT_MISSING', 2, 'observerPresetId is required.');
  }
  if (starIds === undefined) return fail('REQUIRED_INPUT_MISSING', 2, 'starIds is required.');
  const presetId = request.observerPresetId as string;

  // Stage 3: leap validation.
  const validated = validateUtcInstant(supplied, artifacts.leap, scope);
  if (!validated.ok) return fail(validated.outcome, 3, validated.detail);
  const instant = validated.value;
  const leap = artifacts.leap as ApprovedLeapState;

  // Stage 4: activated supported time domain.
  const domain = artifacts.domain;
  if (domain === undefined)
    return fail('REQUIRED_ARTIFACT_UNAVAILABLE', 4, 'No SupportedTimeDomain.');
  if (
    domain.approval.scope !== approvalScopeFor(scope) ||
    domain.profileId !== domainProfileIdFor(scope)
  ) {
    return fail(
      'UNSUPPORTED_PROFILE_DOMAIN',
      4,
      'Supported time domain belongs to another profile.',
    );
  }
  if (!isApprovedFor(domain.approval, scope)) {
    return fail(
      'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
      4,
      `Supported time domain approval is ${domain.approval.state}.`,
    );
  }
  if (!isInsideSupportedDomain(instant, domain)) {
    return fail(
      'TIME_OUTSIDE_SUPPORTED_DOMAIN',
      4,
      `${instant.text} is outside the activated domain.`,
    );
  }

  // Stage 5: observer preset.
  if (!presetAllowed(scope, presetId)) {
    return fail(
      'UNSUPPORTED_PROFILE_DOMAIN',
      5,
      `Observer preset ${presetId} is outside ${profileId}.`,
    );
  }
  const observer = artifacts.observers.get(presetId);
  if (observer === undefined || observer.availability !== 'AVAILABLE') {
    return fail('REQUIRED_ARTIFACT_UNAVAILABLE', 5, `Observer preset ${presetId} unavailable.`);
  }
  const observerValidation = validateObserverPreset(observer);
  if (!observerValidation.ok)
    return fail('REQUIRED_ARTIFACT_UNAVAILABLE', 5, observerValidation.reason);
  if (!isApprovedFor(observer.approval, scope)) {
    return fail(
      'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
      5,
      `Observer preset approval is ${observer.approval.state}.`,
    );
  }

  // Stage 6: per-star availability and eligibility.
  starResults = starIds.map((starId): StarResult => {
    const star = artifacts.stars.get(starId);
    const nonResult = (outcome: StarFailureOutcome, detail: string): StarResult => ({
      kind: 'NON_RESULT',
      starId,
      outcome,
      stage: 6,
      detail,
    });
    if (star === undefined || star.availability !== 'AVAILABLE') {
      return nonResult('REQUIRED_ARTIFACT_UNAVAILABLE', 'No available catalogue row.');
    }
    const eligibility = starEligibility(star);
    if (!eligibility.ok) return nonResult(eligibility.outcome, eligibility.reason);
    if (!isApprovedFor(star.approval, scope)) {
      return nonResult(
        'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
        `Catalogue row approval is ${star.approval.state}.`,
      );
    }
    return { kind: 'NOT_EXECUTED', starId, reason: 'ELIGIBLE_BUT_GLOBAL_FAILURE' };
  });

  // Stage 7: Earth orientation fields.
  const tai = taiFromUtc(instant);
  const tt = ttFromTai(tai);
  const eop = earthOrientationAt(instant, tt, artifacts.eop, leap, scope);
  if (!eop.ok) return fail(eop.outcome, 7, `${eop.field ?? 'bundle'}: ${eop.detail}`);

  // Stage 8: other required approvals are carried by the artifacts validated above.

  // Stage 9: execute the route.
  const ut1 = ut1FromTai(tai, eop.value.ut1MinusTaiSeconds);
  const ephemeris = earthPositionVelocity(tt.part1, tt.part2);
  if (ephemeris.status !== 0) {
    return fail('SCIENTIFIC_EXECUTION_FAILURE', 9, `epv00-derived status ${ephemeris.status}.`);
  }
  const rbpn = biasPrecessionNutationMatrix(tt.part1, tt.part2);
  const { x, y } = cipCoordinatesFromMatrix(rbpn);
  const s = cioLocatorIau2006(tt.part1, tt.part2, x, y);
  const theta = earthRotationAngle(ut1.part1, ut1.part2);
  const sp = tioLocator(tt.part1, tt.part2);
  const ellipsoid = observer.referenceEllipsoid;
  const contextResult = observerAstrometryContext({
    date1: tt.part1,
    date2: tt.part2,
    ebpv: ephemeris.barycentric,
    ehp: ephemeris.heliocentric[0],
    x,
    y,
    s,
    theta,
    elong: observer.geodeticLongitudeDegrees * (Math.PI / 180),
    phi: observer.geodeticLatitudeDegrees * (Math.PI / 180),
    hm: observer.height.valueMetres,
    ellipsoid: {
      equatorialRadiusMetres: ellipsoid.equatorialRadiusMetres,
      flattening: 1 / ellipsoid.inverseFlattening,
    },
    xp: eop.value.xp.value,
    yp: eop.value.yp.value,
    sp,
  });
  if (contextResult.status !== 0) {
    return fail('SCIENTIFIC_EXECUTION_FAILURE', 9, 'Observer geodetic conversion failed.');
  }
  const context = contextResult.context;
  starResults = starResults.map((result): StarResult => {
    if (result.kind !== 'NOT_EXECUTED') return result;
    const star = artifacts.stars.get(result.starId) as CatalogueStarState;
    return executeStar(star, context);
  });

  return {
    outcome: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
    profileId,
    executionScope: scope,
    algorithm: PROFILE_V1_ALGORITHM_IDENTITY,
    observerPresetId: presetId,
    time: {
      utc: instant.text,
      utcQuasiJd: utcQuasiJulianDate(instant),
      tai,
      tt,
      ut1,
      taiMinusUtcSeconds: instant.taiMinusUtcSeconds,
    },
    earthOrientation: eop.value,
    artifactIdentities: [
      leap.identity.payloadSha256,
      domain.domainVersion,
      observer.identity.payloadSha256,
      (artifacts.eop as EopBundle).identity.payloadSha256,
    ],
    stars: starResults,
  };
}

function executeStar(star: CatalogueStarState, context: ObserverAstrometryContext): StarResult {
  const failure = (detail: string): StarResult => ({
    kind: 'NON_RESULT',
    starId: star.starId,
    outcome: 'SCIENTIFIC_EXECUTION_FAILURE',
    stage: 9,
    detail,
  });
  const dec = star.declinationRadians;
  // mu_alpha_star -> dRA/dt for the SOFA coordinate-rate boundary; TT-year = TDB-year rate.
  const pmr = (star.properMotion.muAlphaStarMasPerYear * DMAS2R) / Math.cos(dec);
  const pmd = star.properMotion.muDeltaMasPerYear * DMAS2R;
  const px = star.parallax.parallaxMas / 1000;
  const rv = star.radialVelocity.state === 'APPROVED' ? star.radialVelocity.valueKmPerSecond : 0.0;
  const epoch = sourceEpochAsTdb(star.epoch.julianDate);
  const propagated = propagateStarSafely(
    { ra: star.rightAscensionRadians, dec, pmr, pmd, px, rv },
    epoch.tdb.part1,
    epoch.tdb.part2,
    DJ00,
    0.0,
  );
  if (propagated.status !== 0 || propagated.star === undefined) {
    return failure(`pmsafe-derived status ${propagated.status} (nonzero statuses fail closed).`);
  }
  const p = propagated.star;
  const { ri, di } = icrsToCirs(p.ra, p.dec, p.pmr, p.pmd, p.px, p.rv, context);
  const horizontal = cirsToGeometricHorizontal(ri, di, context);
  if (![horizontal.altitude, ...horizontal.enu].every(Number.isFinite)) {
    return failure('Non-finite geometric direction.');
  }
  return {
    kind: 'DIRECTION',
    starId: star.starId,
    direction: {
      starId: star.starId,
      sourceRecordId: star.sourceRecordId,
      altitudeRadians: horizontal.altitude,
      azimuthRadians: horizontal.azimuth,
      azimuthState: horizontal.azimuth === null ? 'UNDEFINED_SINGULAR' : 'DEFINED',
      enu: horizontal.enu,
      horizonClassification:
        horizontal.altitude < 0 ? 'BELOW_GEOMETRIC_HORIZON' : 'NOT_BELOW_GEOMETRIC_HORIZON',
      scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
      optionalStages: {
        refraction: 'REFRACTION_NOT_REQUESTED',
        visibility: 'PROFILE_EXCLUDED_NOT_REQUESTED',
      },
      statuses: { propagation: propagated.status },
      radialVelocityState: star.radialVelocity.state,
      visualMagnitude: star.visualMagnitude,
    },
  };
}

/** J1991.25 as a two-part TT Julian Date in the MJD_ZERO_PLUS_OFFSET split. */
export function julianEpochToTwoPartTt(julianEpoch: number): TwoPartJulianDate<'TT'> {
  return {
    scale: 'TT',
    splitConvention: 'MJD_ZERO_PLUS_OFFSET',
    part1: DJM0,
    part2: DJ00 - DJM0 + (julianEpoch - 2000.0) * 365.25,
  };
}
