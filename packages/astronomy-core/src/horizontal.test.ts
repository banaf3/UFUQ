import { describe, expect, it } from 'vitest';
import {
  asBearingNorthEastDeg,
  asLocalSiderealTimeHours,
  bearingDistanceDeg,
  enuToHorizontal,
  enuToSceneVector,
  equatorialToEnu,
  equatorialToHorizontal,
  hourAngleWestDeg,
  normalizeDegrees360,
  normalizeDegreesSigned,
  vectorSeparationDeg,
  type EquatorialDirection,
  type HourAngleWestDeg,
} from './index.js';

// Spike fixtures are SYNTHETIC directions, not catalogue stars or approved scenarios.
const synthetic = (raDeg: number, decDeg: number): EquatorialDirection => ({
  raDeg,
  decDeg,
  frameLabel: 'SYNTHETIC-SPIKE-FRAME',
});
const noon = 0 as HourAngleWestDeg;

describe('angle wrapping (provisional representatives)', () => {
  it('wraps to [0, 360) without returning 360 or -0', () => {
    expect(normalizeDegrees360(360)).toBe(0);
    expect(normalizeDegrees360(-1e-20)).toBe(0);
    expect(normalizeDegrees360(-90)).toBe(270);
    expect(Object.is(normalizeDegrees360(-0), 0)).toBe(true);
  });
  it('wraps to [-180, 180)', () => {
    expect(normalizeDegreesSigned(180)).toBe(-180);
    expect(normalizeDegreesSigned(190)).toBe(-170);
    expect(normalizeDegreesSigned(-190)).toBe(170);
  });
});

describe('hour angle', () => {
  it('is west-positive LST - RA', () => {
    const h = hourAngleWestDeg(asLocalSiderealTimeHours(6), synthetic(30, 0));
    expect(h).toBeCloseTo(60, 12);
  });
  it('wraps across 0/24h', () => {
    const h = hourAngleWestDeg(asLocalSiderealTimeHours(1), synthetic(350, 0));
    expect(h).toBeCloseTo(25, 12);
  });
});

describe('equatorial to horizontal (hand-derived cases)', () => {
  const observer = { geodeticLatitudeDeg: 3, longitudeEastDeg: 101 };

  it('puts the north celestial pole at altitude = latitude, azimuth north', () => {
    const result = enuToHorizontal(equatorialToEnu(observer, 123 as HourAngleWestDeg, 90));
    expect(result.status).toBe('defined');
    if (result.status === 'defined') {
      expect(result.geometricAltitudeDeg).toBeCloseTo(3, 9);
      expect(result.azimuthNorthEastDeg).toBeCloseTo(0, 9);
    }
  });

  it('puts a meridian transit south of the zenith at altitude 90 - (phi - delta)', () => {
    const result = enuToHorizontal(
      equatorialToEnu({ ...observer, geodeticLatitudeDeg: 40 }, noon, 10),
    );
    expect(result.status).toBe('defined');
    if (result.status === 'defined') {
      expect(result.geometricAltitudeDeg).toBeCloseTo(60, 9);
      expect(result.azimuthNorthEastDeg).toBeCloseTo(180, 9);
    }
  });

  it('rises due east and sets due west for an equatorial object at the equator', () => {
    const equator = { geodeticLatitudeDeg: 0, longitudeEastDeg: 0 };
    const rising = enuToHorizontal(equatorialToEnu(equator, -90 as HourAngleWestDeg, 0));
    const setting = enuToHorizontal(equatorialToEnu(equator, 90 as HourAngleWestDeg, 0));
    expect(rising.status === 'defined' && rising.azimuthNorthEastDeg).toBeCloseTo(90, 9);
    expect(setting.status === 'defined' && setting.azimuthNorthEastDeg).toBeCloseTo(270, 9);
    expect(rising.geometricAltitudeDeg).toBeCloseTo(0, 9);
  });

  it('reports below-horizon objects with negative altitude (no visibility policy here)', () => {
    const result = equatorialToHorizontal(
      { geodeticLatitudeDeg: 40, longitudeEastDeg: 0 },
      asLocalSiderealTimeHours(12),
      synthetic(0, 10),
    );
    expect(result.geometricAltitudeDeg).toBeLessThan(0);
  });

  it('flags the zenith as azimuth-singular and keeps a usable vector', () => {
    const result = enuToHorizontal({ east: 0, north: 0, up: 1 });
    expect(result.status).toBe('azimuth-singular');
    expect(result.geometricAltitudeDeg).toBeCloseTo(90, 12);
    expect(result.enu.up).toBe(1);
  });

  it('rejects non-finite and out-of-range inputs', () => {
    expect(() =>
      equatorialToEnu({ geodeticLatitudeDeg: 91, longitudeEastDeg: 0 }, noon, 0),
    ).toThrow(RangeError);
    expect(() =>
      equatorialToEnu({ geodeticLatitudeDeg: Number.NaN, longitudeEastDeg: 0 }, noon, 0),
    ).toThrow(RangeError);
    expect(() =>
      equatorialToEnu({ geodeticLatitudeDeg: 0, longitudeEastDeg: 0 }, noon, 91),
    ).toThrow(RangeError);
    expect(() => asLocalSiderealTimeHours(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('returns unit vectors', () => {
    const v = equatorialToEnu(observer, 37 as HourAngleWestDeg, -21);
    expect(Math.hypot(v.east, v.north, v.up)).toBeCloseTo(1, 12);
  });
});

describe('scene mapping (IMP-010)', () => {
  it('maps east to +X, up to +Y, north to -Z', () => {
    expect(enuToSceneVector({ east: 1, north: 0, up: 0 })).toEqual({ x: 1, y: 0, z: 0 });
    expect(enuToSceneVector({ east: 0, north: 0, up: 1 })).toEqual({ x: 0, y: 1, z: 0 });
    expect(enuToSceneVector({ east: 0, north: 1, up: 0 })).toEqual({ x: 0, y: 0, z: -1 });
  });
  it('reproduces the specification fixture h=30, A=45, r=100', () => {
    const h = (30 * Math.PI) / 180;
    const a = (45 * Math.PI) / 180;
    const scene = enuToSceneVector(
      { east: Math.cos(h) * Math.sin(a), north: Math.cos(h) * Math.cos(a), up: Math.sin(h) },
      100,
    );
    expect(scene.x).toBeCloseTo(61.24, 2);
    expect(scene.y).toBeCloseTo(50, 9);
    expect(scene.z).toBeCloseTo(-61.24, 2);
  });
});

describe('angular comparison', () => {
  it('uses wrapped bearing distance', () => {
    expect(bearingDistanceDeg(asBearingNorthEastDeg(350), asBearingNorthEastDeg(10))).toBeCloseTo(
      20,
      9,
    );
    expect(bearingDistanceDeg(asBearingNorthEastDeg(0), asBearingNorthEastDeg(180))).toBe(180);
    expect(bearingDistanceDeg(asBearingNorthEastDeg(90), asBearingNorthEastDeg(90))).toBe(0);
  });
  it('uses robust vector separation, including near-zenith and antipodal pairs', () => {
    const up = { east: 0, north: 0, up: 1 };
    const down = { east: 0, north: 0, up: -1 };
    const tilted = { east: Math.sin(1e-8), north: 0, up: Math.cos(1e-8) };
    expect(vectorSeparationDeg(up, down)).toBeCloseTo(180, 12);
    expect(vectorSeparationDeg(up, up)).toBe(0);
    expect(vectorSeparationDeg(up, tilted)).toBeCloseTo((1e-8 * 180) / Math.PI, 15);
  });
});
