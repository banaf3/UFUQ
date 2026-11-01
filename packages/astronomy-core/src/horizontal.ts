import {
  assertFinite,
  degToRad,
  normalizeDegrees360,
  normalizeDegreesSigned,
  radToDeg,
} from './angles.js';
import type {
  BearingNorthEastDeg,
  EnuUnitVector,
  EquatorialDirection,
  HorizontalCoordinate,
  HourAngleWestDeg,
  LocalSiderealTimeHours,
  ObserverLocation,
  SceneVector,
} from './types.js';

export function validateObserver(observer: ObserverLocation): void {
  assertFinite(observer.geodeticLatitudeDeg, 'geodeticLatitudeDeg');
  assertFinite(observer.longitudeEastDeg, 'longitudeEastDeg');
  if (Math.abs(observer.geodeticLatitudeDeg) > 90) {
    throw new RangeError('geodeticLatitudeDeg must be within [-90, 90]');
  }
}

export function asLocalSiderealTimeHours(hours: number): LocalSiderealTimeHours {
  assertFinite(hours, 'localSiderealTimeHours');
  return hours as LocalSiderealTimeHours;
}

export function asBearingNorthEastDeg(deg: number): BearingNorthEastDeg {
  assertFinite(deg, 'bearing');
  return normalizeDegrees360(deg) as BearingNorthEastDeg;
}

/** `H = normalizeSigned(LST - RA)`, west-positive. LST is an input, never derived here. */
export function hourAngleWestDeg(
  lst: LocalSiderealTimeHours,
  direction: EquatorialDirection,
): HourAngleWestDeg {
  assertFinite(direction.raDeg, 'raDeg');
  return normalizeDegreesSigned(lst * 15 - direction.raDeg) as HourAngleWestDeg;
}

/** ASTRONOMY_SPEC east/north/up formulation for hour angle `H` and declination. */
export function equatorialToEnu(
  observer: ObserverLocation,
  hourAngle: HourAngleWestDeg,
  decDeg: number,
): EnuUnitVector {
  validateObserver(observer);
  assertFinite(decDeg, 'decDeg');
  if (Math.abs(decDeg) > 90) {
    throw new RangeError('decDeg must be within [-90, 90]');
  }
  const phi = degToRad(observer.geodeticLatitudeDeg);
  const delta = degToRad(decDeg);
  const h = degToRad(hourAngle);
  return {
    east: -Math.cos(delta) * Math.sin(h),
    north: Math.sin(delta) * Math.cos(phi) - Math.cos(delta) * Math.cos(h) * Math.sin(phi),
    up: Math.sin(delta) * Math.sin(phi) + Math.cos(delta) * Math.cos(h) * Math.cos(phi),
  };
}

export function enuToHorizontal(enu: EnuUnitVector): HorizontalCoordinate {
  const geometricAltitudeDeg = radToDeg(Math.atan2(enu.up, Math.hypot(enu.east, enu.north)));
  // Exact zero only: any nonzero horizontal component has a well-defined atan2 azimuth.
  // Conditioning near the zenith is poor, so scoring must use vector separation there.
  if (enu.east === 0 && enu.north === 0) {
    return { status: 'azimuth-singular', geometricAltitudeDeg, enu };
  }
  return {
    status: 'defined',
    azimuthNorthEastDeg: asBearingNorthEastDeg(radToDeg(Math.atan2(enu.east, enu.north))),
    geometricAltitudeDeg,
    enu,
  };
}

export function equatorialToHorizontal(
  observer: ObserverLocation,
  lst: LocalSiderealTimeHours,
  direction: EquatorialDirection,
): HorizontalCoordinate {
  const hourAngle = hourAngleWestDeg(lst, direction);
  return enuToHorizontal(equatorialToEnu(observer, hourAngle, direction.decDeg));
}

/** Approved ENU to Three.js axis mapping (IMP-010): x = east, y = up, z = -north. */
export function enuToSceneVector(enu: EnuUnitVector, radius = 1): SceneVector {
  assertFinite(radius, 'radius');
  const z = -radius * enu.north;
  return { x: radius * enu.east, y: radius * enu.up, z: z === 0 ? 0 : z };
}
