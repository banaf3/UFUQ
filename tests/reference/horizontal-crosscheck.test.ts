import { describe, expect, it } from 'vitest';
import { enuToHorizontal, equatorialToEnu, type HourAngleWestDeg } from '@ufuq/astronomy-core';
import { sphericalTrigHorizontal } from '@ufuq/astronomy-reference';

/**
 * Phase 1 SPIKE: formulation-level comparison of the runtime east/north/up route with an
 * independent spherical-trigonometry route. This is NOT the pinned Astropy/USNO oracle
 * and establishes no scientific agreement. The bound below is a diagnostic for
 * double-precision implementation noise only; it is not an AST-006 tolerance.
 */
const SPIKE_DIAGNOSTIC_ONLY_DEG = 1e-9;

function wrapDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

describe('runtime ENU route vs independent spherical-trig route (synthetic grid)', () => {
  it('agrees in altitude and azimuth away from the zenith/nadir and poles', () => {
    let worstAltitudeDeg = 0;
    let worstAzimuthDeg = 0;
    let compared = 0;

    for (const latitudeDeg of [-60, -20, 0, 3, 20, 45, 60]) {
      for (let hourAngle = -180; hourAngle < 180; hourAngle += 15) {
        for (const decDeg of [-70, -30, 0, 10, 45, 80]) {
          const runtime = enuToHorizontal(
            equatorialToEnu(
              { geodeticLatitudeDeg: latitudeDeg, longitudeEastDeg: 0 },
              hourAngle as HourAngleWestDeg,
              decDeg,
            ),
          );
          const reference = sphericalTrigHorizontal(latitudeDeg, hourAngle, decDeg);
          // Skip the near-singular zenith/nadir, where the reference route loses precision.
          if (Math.abs(runtime.geometricAltitudeDeg) > 89.9) continue;
          if (runtime.status !== 'defined' || reference.azimuthDeg === null) continue;
          // Skip the meridian, where acos conditioning dominates the reference azimuth.
          if (hourAngle === 0 || hourAngle === -180) {
            expect(runtime.geometricAltitudeDeg).toBeCloseTo(reference.altitudeDeg, 9);
            continue;
          }
          worstAltitudeDeg = Math.max(
            worstAltitudeDeg,
            Math.abs(runtime.geometricAltitudeDeg - reference.altitudeDeg),
          );
          worstAzimuthDeg = Math.max(
            worstAzimuthDeg,
            wrapDifference(runtime.azimuthNorthEastDeg, reference.azimuthDeg),
          );
          compared += 1;
        }
      }
    }

    // Recorded, not hidden: the observed worst cases are printed for the evidence log.
    console.info(
      `[spike-crosscheck] compared=${compared} worstAltitudeDeg=${worstAltitudeDeg} worstAzimuthDeg=${worstAzimuthDeg}`,
    );
    expect(compared).toBeGreaterThan(500);
    expect(worstAltitudeDeg).toBeLessThan(SPIKE_DIAGNOSTIC_ONLY_DEG);
    expect(worstAzimuthDeg).toBeLessThan(SPIKE_DIAGNOSTIC_ONLY_DEG);
  });
});
