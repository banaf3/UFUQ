import { describe, expect, it } from 'vitest';

import { sphericalInitialBearing } from '../src/qibla/spherical-bearing.js';

const deg = (radians: number) => (radians * 180) / Math.PI;

describe('spherical initial bearing (NFR-2)', () => {
  it('points due north, east, south and west along the cardinal great circles', () => {
    const at = (lat: number, lon: number) =>
      sphericalInitialBearing(
        { latitudeDegrees: 0, longitudeDegrees: 0 },
        { latitudeDegrees: lat, longitudeDegrees: lon },
      );
    const values = [at(10, 0), at(0, 10), at(-10, 0), at(0, -10)].map((r) =>
      r.kind === 'BEARING' ? deg(r.azimuthRadians) : NaN,
    );
    expect(values[0]).toBeCloseTo(0, 12);
    expect(values[1]).toBeCloseTo(90, 12);
    expect(values[2]).toBeCloseTo(180, 12);
    expect(values[3]).toBeCloseTo(270, 12);
  });

  it('wraps into [0, 360) and handles the 180 degree meridian', () => {
    const result = sphericalInitialBearing(
      { latitudeDegrees: 0, longitudeDegrees: 179 },
      { latitudeDegrees: 0, longitudeDegrees: -179 },
    );
    expect(result.kind).toBe('BEARING');
    if (result.kind === 'BEARING') expect(deg(result.azimuthRadians)).toBeCloseTo(90, 9);
  });

  it('reports degenerate geometry instead of guessing a direction', () => {
    const kaaba = { latitudeDegrees: 21.4225079, longitudeDegrees: 39.826189 };
    expect(sphericalInitialBearing(kaaba, kaaba)).toEqual({
      kind: 'UNDEFINED',
      reason: 'COINCIDENT_POINTS',
    });
    expect(
      sphericalInitialBearing(
        { latitudeDegrees: -21.4225079, longitudeDegrees: 39.826189 - 180 },
        kaaba,
      ),
    ).toEqual({ kind: 'UNDEFINED', reason: 'ANTIPODAL_POINTS' });
    expect(sphericalInitialBearing({ latitudeDegrees: 90, longitudeDegrees: 0 }, kaaba)).toEqual({
      kind: 'UNDEFINED',
      reason: 'OBSERVER_AT_POLE',
    });
    expect(
      sphericalInitialBearing({ latitudeDegrees: Number.NaN, longitudeDegrees: 0 }, kaaba),
    ).toEqual({ kind: 'UNDEFINED', reason: 'INVALID_INPUT' });
    expect(sphericalInitialBearing({ latitudeDegrees: 91, longitudeDegrees: 0 }, kaaba)).toEqual({
      kind: 'UNDEFINED',
      reason: 'INVALID_INPUT',
    });
  });

  it('keeps longitude sign and order: swapping the points is not the same bearing', () => {
    const pekan = { latitudeDegrees: 3.5466545, longitudeDegrees: 103.4273953 };
    const kaaba = { latitudeDegrees: 21.4225079, longitudeDegrees: 39.826189 };
    const there = sphericalInitialBearing(pekan, kaaba);
    const back = sphericalInitialBearing(kaaba, pekan);
    if (there.kind !== 'BEARING' || back.kind !== 'BEARING') throw new Error('degenerate');
    expect(deg(there.azimuthRadians)).toBeCloseTo(292.1207727667, 9);
    expect(Math.abs(deg(back.azimuthRadians) - deg(there.azimuthRadians))).toBeGreaterThan(1);
    const flipped = sphericalInitialBearing(
      { latitudeDegrees: 3.5466545, longitudeDegrees: -103.4273953 },
      kaaba,
    );
    expect(flipped.kind === 'BEARING' && deg(flipped.azimuthRadians) < 180).toBe(true);
  });
});
