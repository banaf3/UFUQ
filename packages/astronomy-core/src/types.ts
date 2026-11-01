/**
 * Typed coordinate values. Units and conventions are carried in field names; distinct
 * brands stop a bearing, hour angle or sidereal time from being passed as another angle.
 * Longitude is east-positive and latitude north-positive (ASTRONOMY_SPEC).
 */

declare const brand: unique symbol;
type Brand<T, Name extends string> = T & { readonly [brand]: Name };

/** Clockwise from geographic True North, degrees in the provisional range `[0, 360)`. */
export type BearingNorthEastDeg = Brand<number, 'BearingNorthEastDeg'>;

/** West-positive hour angle `LST - RA`, degrees in the provisional range `[-180, 180)`. */
export type HourAngleWestDeg = Brand<number, 'HourAngleWestDeg'>;

/** Local sidereal time in hours, supplied by the caller; this package derives none. */
export type LocalSiderealTimeHours = Brand<number, 'LocalSiderealTimeHours'>;

export interface ObserverLocation {
  readonly geodeticLatitudeDeg: number;
  readonly longitudeEastDeg: number;
}

/**
 * Equatorial direction in a frame chosen by the caller. The frame label is opaque here:
 * the catalogue-to-apparent pipeline is an unresolved AST-003 decision.
 */
export interface EquatorialDirection {
  readonly raDeg: number;
  readonly decDeg: number;
  readonly frameLabel: string;
}

export interface EnuUnitVector {
  readonly east: number;
  readonly north: number;
  readonly up: number;
}

export type HorizontalCoordinate =
  | {
      readonly status: 'defined';
      readonly azimuthNorthEastDeg: BearingNorthEastDeg;
      readonly geometricAltitudeDeg: number;
      readonly enu: EnuUnitVector;
    }
  | {
      /** Zenith or nadir: azimuth is undefined; compare `enu` vectors instead. */
      readonly status: 'azimuth-singular';
      readonly geometricAltitudeDeg: number;
      readonly enu: EnuUnitVector;
    };

/** Three.js-axis tuple `(x, y, z) = (east, up, -north)`; no Three.js dependency. */
export interface SceneVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
