import { assertFinite, normalizeDegreesSigned, radToDeg } from './angles.js';
import type { BearingNorthEastDeg, EnuUnitVector } from './types.js';

/** `atan2(|u x v|, u . v)` in degrees; robust for tiny and near-antipodal separations. */
export function vectorSeparationDeg(u: EnuUnitVector, v: EnuUnitVector): number {
  const cx = u.north * v.up - u.up * v.north;
  const cy = u.up * v.east - u.east * v.up;
  const cz = u.east * v.north - u.north * v.east;
  const dot = u.east * v.east + u.north * v.north + u.up * v.up;
  return radToDeg(Math.atan2(Math.hypot(cx, cy, cz), dot));
}

/** Wrapped circular difference between two bearings in degrees, `[0, 180]`. */
export function bearingDistanceDeg(a: BearingNorthEastDeg, b: BearingNorthEastDeg): number {
  assertFinite(a, 'a');
  assertFinite(b, 'b');
  // normalizeDegreesSigned maps to [-180, 180); its magnitude is at most 180.
  return Math.abs(normalizeDegreesSigned(a - b));
}
