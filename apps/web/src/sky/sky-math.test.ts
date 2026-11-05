import { describe, expect, it } from 'vitest';

import {
  altAz,
  clampFov,
  createProjector,
  directionFromAltAz,
  greatCircle,
  PROJECTIONS,
  type ProjectionId,
  viewRotation,
} from './projection.js';
import { blackbodySrgb, starColor, starSprite, temperatureFromBV } from './star-appearance.js';

const DEG = Math.PI / 180;
const ids = Object.keys(PROJECTIONS) as ProjectionId[];

describe('zenithal projections (Calabretta & Greisen 2002, section 5.1)', () => {
  it.each([
    ['STEREOGRAPHIC', 90, 2],
    ['PERSPECTIVE', 45, 1],
    ['FISHEYE', 90, Math.PI / 2],
    ['EQUAL_AREA', 180, 2],
    ['ORTHOGRAPHIC', 90, 1],
  ] as const)('%s maps rho=%d degrees to R=%f', (id, rho, expected) => {
    expect(PROJECTIONS[id].forward(rho * DEG)).toBeCloseTo(expected, 12);
  });

  it.each(ids)('%s inverts its own radial function', (id) => {
    const projection = PROJECTIONS[id];
    for (const rho of [0.001, 10, 30, 60, 85].map((d) => d * DEG)) {
      expect(projection.inverse(projection.forward(rho))).toBeCloseTo(rho, 12);
    }
  });

  it('keeps Stellarium field-of-view limits', () => {
    expect(clampFov(300 * DEG, 'PERSPECTIVE')).toBeCloseTo(120 * DEG, 12);
    expect(clampFov(300 * DEG, 'STEREOGRAPHIC')).toBeCloseTo(235 * DEG, 12);
    expect(clampFov(0.1 * DEG, 'FISHEYE')).toBeCloseTo(2 * DEG, 12);
  });
});

describe('view frame and projector', () => {
  it('builds an orthonormal rotation that looks at the view centre', () => {
    const m = viewRotation(40 * DEG, 25 * DEG);
    const rows = [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)];
    for (let i = 0; i < 3; i += 1)
      for (let j = 0; j < 3; j += 1) {
        const dot = rows[i]!.reduce((s, v, k) => s + v * rows[j]![k]!, 0);
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 12);
      }
  });

  it.each(ids)('%s puts the view centre at the screen centre and round-trips', (projection) => {
    const view = { azimuth: 30 * DEG, altitude: 20 * DEG, fov: 90 * DEG, projection };
    const projector = createProjector(view, 1200, 800);
    const centre = projector.project(directionFromAltAz(20 * DEG, 30 * DEG));
    expect(centre?.[0]).toBeCloseTo(0, 9);
    expect(centre?.[1]).toBeCloseTo(0, 9);
    const target = directionFromAltAz(35 * DEG, 55 * DEG);
    const screen = projector.project(target) as [number, number];
    const back = projector.unproject(screen[0], screen[1]) as [number, number, number];
    back.forEach((value, i) => expect(value).toBeCloseTo(target[i]!, 9));
  });

  it('shows east to the right and the zenith up when facing north', () => {
    const projector = createProjector(
      { azimuth: 0, altitude: 0, fov: 120 * DEG, projection: 'STEREOGRAPHIC' },
      1000,
      1000,
    );
    const east = projector.project(directionFromAltAz(0, 30 * DEG)) as [number, number];
    const up = projector.project(directionFromAltAz(30 * DEG, 0)) as [number, number];
    expect(east[0]).toBeGreaterThan(0);
    expect(Math.abs(east[1])).toBeLessThan(1e-9);
    expect(up[1]).toBeGreaterThan(0);
  });

  it('spans the field of view across the smaller side', () => {
    const projector = createProjector(
      { azimuth: 0, altitude: 0, fov: 60 * DEG, projection: 'PERSPECTIVE' },
      1600,
      900,
    );
    const edge = projector.project(directionFromAltAz(30 * DEG, 0)) as [number, number];
    expect(edge[1]).toBeCloseTo(450, 6);
  });

  it('refuses directions a projection cannot show', () => {
    const projector = createProjector(
      { azimuth: 0, altitude: 0, fov: 60 * DEG, projection: 'PERSPECTIVE' },
      800,
      800,
    );
    expect(projector.project(directionFromAltAz(0, Math.PI))).toBeNull();
  });

  it('round-trips altitude and azimuth and samples great circles', () => {
    const { altitude, azimuth } = altAz(directionFromAltAz(12 * DEG, 300 * DEG));
    expect(altitude).toBeCloseTo(12 * DEG, 12);
    expect(azimuth).toBeCloseTo(300 * DEG, 12);
    const arc = greatCircle(directionFromAltAz(0, 0), directionFromAltAz(0, 90 * DEG), 10 * DEG);
    expect(arc.length).toBe(10);
    for (const point of arc) expect(Math.hypot(...point)).toBeCloseTo(1, 12);
  });
});

describe('star appearance', () => {
  it('follows Ballesteros (2012) for B-V', () => {
    // The Sun, B-V about 0.65, is near 5,800 K under this formula.
    expect(temperatureFromBV(0.65)).toBeGreaterThan(5600);
    expect(temperatureFromBV(0.65)).toBeLessThan(6000);
    expect(temperatureFromBV(-0.3)).toBeGreaterThan(temperatureFromBV(1.5));
  });

  it('colours hot stars blue and cool stars red', () => {
    const [rHot, , bHot] = blackbodySrgb(20000);
    const [rCool, , bCool] = blackbodySrgb(3200);
    expect(bHot).toBeGreaterThan(rHot);
    expect(rCool).toBeGreaterThan(bCool);
    expect(starColor(null)).toEqual([1, 1, 1]);
    for (const channel of starColor(0.0)) expect(channel).toBeGreaterThan(0.6);
  });

  it('makes brighter stars larger and fades the faintest', () => {
    const sirius = starSprite(-1.46);
    const polaris = starSprite(1.98);
    const faint = starSprite(6.3);
    expect(sirius.radius).toBeGreaterThan(polaris.radius);
    expect(polaris.radius).toBeGreaterThan(faint.radius);
    expect(starSprite(6.5)).toEqual({ radius: 1, alpha: 0.35 });
    expect(faint.alpha).toBeLessThan(1);
    expect(polaris.alpha).toBe(1);
    expect(starSprite(7)).toEqual({ radius: 0, alpha: 0 });
    // Disc area tracks Pogson flux compressed by the 0.5 point-source exponent.
    const ratio = (starSprite(0).radius / starSprite(2.5).radius) ** 2;
    expect(ratio).toBeCloseTo(10 ** 0.5, 10);
  });
});

describe('figure line trimming', () => {
  it('leaves a gap at both ends and keeps short segments visible', async () => {
    const { trimPolyline } = await import('./sky-types.js');
    const trimmed = trimPolyline(
      [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      6,
      6,
    );
    expect(trimmed[0]).toEqual([6, 0]);
    expect(trimmed.at(-1)).toEqual([94, 0]);
    const short = trimPolyline(
      [
        [0, 0],
        [10, 0],
      ],
      6,
      6,
    );
    expect(short[0]?.[0]).toBeCloseTo(2.5, 10);
    expect(short.at(-1)?.[0]).toBeCloseTo(7.5, 10);
  });
});

describe('label fonts', () => {
  it('reads the pixel size of a canvas font', async () => {
    const { fontPixels } = await import('./sky-types.js');
    expect(fontPixels("500 16px 'Tajawal', sans-serif")).toBe(16);
    expect(fontPixels('600 12.5px Inter')).toBe(12.5);
    expect(fontPixels('bold serif')).toBe(14);
  });
});
