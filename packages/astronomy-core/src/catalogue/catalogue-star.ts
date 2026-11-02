/** Source-neutral normalized catalogue state for one route star (ScientificProfileV1). */
import { DJM0 } from '../astrometry/constants.js';
import { tdbMinusTt } from '../astrometry/earth-rotation.js';
import type {
  ArtifactAvailability,
  ArtifactIdentity,
  ScientificApproval,
} from '../common/provenance.js';
import type { TwoPartJulianDate } from '../time/utc.js';

export type RadialVelocityState =
  | {
      readonly state: 'APPROVED';
      readonly valueKmPerSecond: number;
      readonly source: string;
    }
  | {
      /** ScientificProfileV1 Amendment A1: second-order perspective term omitted with a bound. */
      readonly state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND';
      readonly omittedTerm: 'SECOND_ORDER_PERSPECTIVE_ACCELERATION';
      readonly boundMilliarcsecondsPerKmPerSecond: number;
      readonly boundHorizonJulianEpoch: number;
      readonly evidenceId: string;
    };

export interface CatalogueStarState {
  readonly starId: string;
  readonly sourceRecordId: string;
  readonly rightAscensionRadians: number;
  readonly declinationRadians: number;
  readonly epoch: {
    readonly nativeNotation: string;
    readonly scale: 'TT';
    readonly julianDate: TwoPartJulianDate<'TT'>;
  };
  readonly properMotion: {
    /** mu_alpha_star = dRA/dt * cos(dec). */
    readonly muAlphaStarMasPerYear: number;
    readonly muDeltaMasPerYear: number;
    readonly durationUnit: 'JULIAN_YEAR';
    readonly derivativeScale: 'TT';
  };
  readonly parallax: {
    readonly state: 'APPROVED_USABLE_DISTANCE';
    readonly parallaxMas: number;
  };
  readonly radialVelocity: RadialVelocityState;
  readonly visualMagnitude: number | null;
  readonly identity: ArtifactIdentity;
  readonly availability: ArtifactAvailability;
  readonly approval: ScientificApproval;
}

export type StarEligibility =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly outcome: 'UNSUPPORTED_PROFILE_DOMAIN' | 'INVALID_INPUT';
      readonly reason: string;
    };

/** Stage 6 structural eligibility of a normalized row (approval is checked separately). */
export function starEligibility(star: CatalogueStarState): StarEligibility {
  const finite = [
    star.rightAscensionRadians,
    star.declinationRadians,
    star.properMotion.muAlphaStarMasPerYear,
    star.properMotion.muDeltaMasPerYear,
    star.parallax.parallaxMas,
  ].every(Number.isFinite);
  if (!finite) return { ok: false, outcome: 'INVALID_INPUT', reason: 'Non-finite astrometry.' };
  if (Math.abs(star.declinationRadians) >= Math.PI / 2) {
    return {
      ok: false,
      outcome: 'UNSUPPORTED_PROFILE_DOMAIN',
      reason: 'Exact celestial pole: RA rate is singular.',
    };
  }
  if (!(star.parallax.parallaxMas > 0)) {
    return {
      ok: false,
      outcome: 'UNSUPPORTED_PROFILE_DOMAIN',
      reason: 'Parallax is not a usable positive distance.',
    };
  }
  if (
    star.radialVelocity.state === 'APPROVED' &&
    !Number.isFinite(star.radialVelocity.valueKmPerSecond)
  ) {
    return { ok: false, outcome: 'INVALID_INPUT', reason: 'Radial velocity not finite.' };
  }
  return { ok: true };
}

/**
 * Source epoch adapter `CATALOGUE_TT_EPOCH_TO_TDB_GEOCENTRIC_V1`: the same epoch event
 * expressed in TDB by adding the geocentric TDB-TT of the SOFA `dtdb`-derived model
 * (u = v = 0). The epoch is never relabelled; the conversion is recorded with its model.
 */
export function sourceEpochAsTdb(epoch: TwoPartJulianDate<'TT'>): {
  readonly tdb: TwoPartJulianDate<'TDB'>;
  readonly tdbMinusTtSeconds: number;
  readonly conversionId: 'CATALOGUE_TT_EPOCH_TO_TDB_GEOCENTRIC_V1';
} {
  const dtr = tdbMinusTt(epoch.part1, epoch.part2, 0, 0, 0, 0);
  return {
    tdb: {
      scale: 'TDB',
      splitConvention: 'MJD_ZERO_PLUS_OFFSET',
      part1: DJM0,
      part2: epoch.part2 + dtr / 86400.0,
    },
    tdbMinusTtSeconds: dtr,
    conversionId: 'CATALOGUE_TT_EPOCH_TO_TDB_GEOCENTRIC_V1',
  };
}
