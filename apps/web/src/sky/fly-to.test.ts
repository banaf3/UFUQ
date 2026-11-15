import { describe, expect, it } from 'vitest';

import { easeInOutCubic, flyPath } from './fly-to.js';
import { directionFromAltAz, type ViewState } from './projection.js';

const DEG = Math.PI / 180;
const view = (azimuth: number, altitude: number, fov: number): ViewState => ({
  azimuth: azimuth * DEG,
  altitude: altitude * DEG,
  fov: fov * DEG,
  projection: 'STEREOGRAPHIC',
});
const angle = (a: ViewState, b: ViewState) => {
  const x = directionFromAltAz(a.altitude, a.azimuth);
  const y = directionFromAltAz(b.altitude, b.azimuth);
  return Math.acos(Math.min(1, x[0] * y[0] + x[1] * y[1] + x[2] * y[2]));
};

describe('van Wijk and Nuij flights on the sky', () => {
  it('starts and ends exactly at the two views', () => {
    const from = view(10, 40, 30);
    const to = view(200, 20, 40);
    const flight = flyPath(from, to);
    expect(flight.at(0)).toEqual(from);
    expect(flight.at(1)).toEqual(to);
  });

  it('zooms out on a long pan and back in, never beyond the projection limit', () => {
    const from = view(0, 30, 20);
    const to = view(120, 30, 20);
    const flight = flyPath(from, to, 120 * DEG);
    const widest = Math.max(...Array.from({ length: 41 }, (_, i) => flight.at(i / 40).fov));
    expect(widest).toBeGreaterThan(from.fov * 1.5);
    expect(widest).toBeLessThanOrEqual(120 * DEG + 1e-12);
  });

  it('moves the centre steadily towards the target along the great circle', () => {
    const from = view(350, 10, 60);
    const to = view(30, 50, 25);
    const flight = flyPath(from, to);
    let previous = angle(from, to);
    for (let i = 1; i <= 20; i += 1) {
      const remaining = angle(flight.at(i / 20), to);
      expect(remaining).toBeLessThanOrEqual(previous + 1e-9);
      previous = remaining;
    }
  });

  it('handles a pure zoom and gives longer flights more time', () => {
    const zoom = flyPath(view(0, 30, 80), view(0, 30, 20));
    expect(zoom.at(0.5).fov).toBeLessThan(80 * DEG);
    expect(zoom.at(0.5).fov).toBeGreaterThan(20 * DEG);
    const near = flyPath(view(0, 30, 40), view(10, 30, 40));
    const far = flyPath(view(0, 30, 40), view(150, 30, 40));
    expect(far.durationMs).toBeGreaterThan(near.durationMs);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
  });
});
