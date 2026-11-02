/**
 * SkyDisplayPolicyV1: the background star field drawn behind lessons and in the sky
 * explorer. It reuses the ScientificProfileV1 stage-9 route (same context, pmsafe-derived
 * propagation, atciq-derived CIRS, geometric atioq) for display only. Two documented cases
 * that ScientificProfileV1 rejects are accepted here and flagged on every result:
 *
 * - a non-positive Hipparcos parallax: SOFA `iauStarpv` substitutes its minimum parallax
 *   and reports status 1 ("distance overridden"); the policy accepts status 1 only;
 * - no Hipparcos astrometric solution: the catalogue's coarse ICRS h/m/s position at
 *   J1991.25 is used with zero proper motion.
 *
 * Display results are never assessed. Lesson targets keep the full ScientificProfileV1
 * path (`executeStar`), and the field's own approval gates it per execution scope.
 */
import { DJ00, DMAS2R } from '../astrometry/constants.js';
import {
  type ObserverAstrometryContext,
  cirsToGeometricHorizontal,
  icrsToCirs,
} from '../astrometry/astrometry-context.js';
import { propagateStarSafely } from '../astrometry/space-motion.js';
import type { Vec3 } from '../astrometry/vector.js';
import { sourceEpochAsTdb } from '../catalogue/catalogue-star.js';
import type { ArtifactIdentity, ScientificApproval } from '../common/provenance.js';
import type { TwoPartJulianDate } from '../time/utc.js';

export const SKY_DISPLAY_POLICY_V1 = {
  policyId: 'SKY_DISPLAY_POLICY_V1',
  use: 'DISPLAY_ONLY_NEVER_ASSESSED',
  route: 'ScientificProfileV1 stage-9 route',
  acceptedPropagationStatuses: [0, 1],
} as const;

export type DisplayAstrometry = 'FULL_SOLUTION' | 'COARSE_POSITION_NO_SOLUTION';

export interface DisplayStarInput {
  readonly starId: string;
  readonly astrometry: DisplayAstrometry;
  readonly rightAscensionRadians: number;
  readonly declinationRadians: number;
  /** May be zero or negative; the SOFA minimum-parallax override then applies. */
  readonly parallaxMas: number;
  readonly muAlphaStarMasPerYear: number;
  readonly muDeltaMasPerYear: number;
  readonly visualMagnitude: number;
  readonly colorIndexBV: number | null;
}

export interface SkyDisplayField {
  readonly identity: ArtifactIdentity;
  readonly approval: ScientificApproval;
  readonly epoch: TwoPartJulianDate<'TT'>;
  readonly stars: readonly DisplayStarInput[];
}

export type DisplayFlag = 'SOFA_MINIMUM_PARALLAX_OVERRIDE' | 'COARSE_POSITION_NO_SOLUTION';

export interface DisplayStarResult {
  readonly starId: string;
  readonly enu: Vec3;
  readonly altitudeRadians: number;
  readonly azimuthRadians: number | null;
  readonly visualMagnitude: number;
  readonly colorIndexBV: number | null;
  readonly flags: readonly DisplayFlag[];
}

/** One display star through the shared route; null when the route reports a failure. */
export function executeDisplayStar(
  star: DisplayStarInput,
  epoch: TwoPartJulianDate<'TT'>,
  context: ObserverAstrometryContext,
): DisplayStarResult | null {
  const dec = star.declinationRadians;
  const values = [
    star.rightAscensionRadians,
    dec,
    star.parallaxMas,
    star.muAlphaStarMasPerYear,
    star.muDeltaMasPerYear,
    star.visualMagnitude,
  ];
  if (!values.every(Number.isFinite) || Math.abs(dec) >= Math.PI / 2) return null;
  const flags: DisplayFlag[] = [];
  if (star.astrometry === 'COARSE_POSITION_NO_SOLUTION') flags.push('COARSE_POSITION_NO_SOLUTION');
  const pmr = (star.muAlphaStarMasPerYear * DMAS2R) / Math.cos(dec);
  const pmd = star.muDeltaMasPerYear * DMAS2R;
  const px = star.parallaxMas > 0 ? star.parallaxMas / 1000 : 0.0;
  const tdb = sourceEpochAsTdb(epoch).tdb;
  const propagated = propagateStarSafely(
    { ra: star.rightAscensionRadians, dec, pmr, pmd, px, rv: 0.0 },
    tdb.part1,
    tdb.part2,
    DJ00,
    0.0,
  );
  if (propagated.star === undefined) return null;
  if (propagated.status === 1) flags.push('SOFA_MINIMUM_PARALLAX_OVERRIDE');
  else if (propagated.status !== 0) return null;
  const p = propagated.star;
  const { ri, di } = icrsToCirs(p.ra, p.dec, p.pmr, p.pmd, p.px, p.rv, context);
  const horizontal = cirsToGeometricHorizontal(ri, di, context);
  if (![horizontal.altitude, ...horizontal.enu].every(Number.isFinite)) return null;
  return {
    starId: star.starId,
    enu: horizontal.enu,
    altitudeRadians: horizontal.altitude,
    azimuthRadians: horizontal.azimuth,
    visualMagnitude: star.visualMagnitude,
    colorIndexBV: star.colorIndexBV,
    flags,
  };
}

export type SkyDisplayResult =
  | {
      readonly status: 'ACCEPTED';
      readonly policyId: typeof SKY_DISPLAY_POLICY_V1.policyId;
      readonly fieldIdentity: ArtifactIdentity;
      readonly stars: readonly DisplayStarResult[];
      readonly omittedStarIds: readonly string[];
    }
  | { readonly status: 'NOT_ACCEPTED'; readonly reason: string };
