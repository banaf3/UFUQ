/**
 * Qibla direction as the initial great-circle bearing on a sphere (the founding report's
 * NFR-2: "established spherical trigonometry formulas utilized in traditional Ilm
 * al-Falak"; docs/references/syntheses/qibla-geodesy-synthesis.md: the runtime uses the
 * spherical initial bearing). This is UFUQ's own code, not a geodesic library.
 *
 * With observer latitude phi1, destination latitude phi2 and the destination's longitude
 * minus the observer's, dLambda (east-positive), the bearing clockwise from True North is
 *
 *   q = atan2( sin(dLambda) cos(phi2),
 *              cos(phi1) sin(phi2) - sin(phi1) cos(phi2) cos(dLambda) ),
 *
 * the same direction as the falak cotangent rule
 * cot q = (cos(phi1) tan(phi2) - sin(phi1) cos(dLambda)) / sin(dLambda).
 *
 * Degenerate geometry has no single direction and is reported, never guessed:
 * coincident points, antipodal points (every direction is a shortest path), and an
 * observer at a pole (azimuth from True North is undefined there).
 */

export interface GeodeticPoint {
  readonly latitudeDegrees: number;
  /** East-positive. */
  readonly longitudeDegrees: number;
}

export type QiblaBearingResult =
  | {
      readonly kind: 'BEARING';
      /** Clockwise from True North, in [0, 2 pi). */
      readonly azimuthRadians: number;
      /** Central angle between the points (rad), for distance and reporting. */
      readonly centralAngleRadians: number;
    }
  | {
      readonly kind: 'UNDEFINED';
      readonly reason:
        'INVALID_INPUT' | 'COINCIDENT_POINTS' | 'ANTIPODAL_POINTS' | 'OBSERVER_AT_POLE';
    };

const DEG = Math.PI / 180;
/** Below this the geometry is treated as degenerate (about 6 mm on the Earth). */
const DEGENERATE_RADIANS = 1e-9;

function valid(point: GeodeticPoint): boolean {
  return (
    Number.isFinite(point.latitudeDegrees) &&
    Number.isFinite(point.longitudeDegrees) &&
    Math.abs(point.latitudeDegrees) <= 90 &&
    Math.abs(point.longitudeDegrees) <= 180
  );
}

export function sphericalInitialBearing(
  observer: GeodeticPoint,
  destination: GeodeticPoint,
): QiblaBearingResult {
  if (!valid(observer) || !valid(destination))
    return { kind: 'UNDEFINED', reason: 'INVALID_INPUT' };
  const phi1 = observer.latitudeDegrees * DEG;
  const phi2 = destination.latitudeDegrees * DEG;
  const dLambda = (destination.longitudeDegrees - observer.longitudeDegrees) * DEG;
  if (Math.PI / 2 - Math.abs(phi1) < DEGENERATE_RADIANS)
    return { kind: 'UNDEFINED', reason: 'OBSERVER_AT_POLE' };
  // Central angle by the haversine-stable atan2 form (accurate near 0 and near pi).
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinPhi2 = Math.sin(phi2);
  const cosPhi2 = Math.cos(phi2);
  const y = Math.sin(dLambda) * cosPhi2;
  const x = cosPhi1 * sinPhi2 - sinPhi1 * cosPhi2 * Math.cos(dLambda);
  const central = Math.atan2(
    Math.hypot(y, x),
    sinPhi1 * sinPhi2 + cosPhi1 * cosPhi2 * Math.cos(dLambda),
  );
  if (central < DEGENERATE_RADIANS) return { kind: 'UNDEFINED', reason: 'COINCIDENT_POINTS' };
  if (Math.PI - central < DEGENERATE_RADIANS)
    return { kind: 'UNDEFINED', reason: 'ANTIPODAL_POINTS' };
  const azimuth = Math.atan2(y, x);
  return {
    kind: 'BEARING',
    azimuthRadians: azimuth < 0 ? azimuth + 2 * Math.PI : azimuth,
    centralAngleRadians: central,
  };
}
