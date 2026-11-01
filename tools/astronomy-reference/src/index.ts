/**
 * Independent reference-tool boundary. Phase 1 SPIKE.
 *
 * This is a *formulation-level* cross-check, NOT the pinned Astropy/USNO oracle that
 * ASTRONOMY_SPEC requires (Python/Astropy are not available in this environment). It is
 * written without importing `@ufuq/astronomy-core` and uses the classical
 * spherical-trigonometry route (sin h, then cos A with a hour-angle sign test) instead of
 * the runtime's east/north/up vector route. It has known conditioning loss near the
 * zenith/nadir and poles, which is why it can only be a diagnostic comparison.
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface ReferenceHorizontal {
  readonly azimuthDeg: number | null;
  readonly altitudeDeg: number;
}

/** West-positive hour angle in degrees (any wrap), declination and latitude in degrees. */
export function sphericalTrigHorizontal(
  latitudeDeg: number,
  hourAngleWestDeg: number,
  declinationDeg: number,
): ReferenceHorizontal {
  const phi = latitudeDeg * D2R;
  const delta = declinationDeg * D2R;
  const h = hourAngleWestDeg * D2R;

  const sinAlt = Math.sin(delta) * Math.sin(phi) + Math.cos(delta) * Math.cos(phi) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const denominator = Math.cos(alt) * Math.cos(phi);
  if (denominator === 0) {
    return { azimuthDeg: null, altitudeDeg: alt * R2D };
  }
  const cosAz = (Math.sin(delta) - sinAlt * Math.sin(phi)) / denominator;
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * R2D;
  // Object east of the meridian (sin H < 0, before transit) lies on the eastern side.
  if (Math.sin(h) > 0) {
    az = 360 - az;
  }
  return { azimuthDeg: az === 360 ? 0 : az, altitudeDeg: alt * R2D };
}
