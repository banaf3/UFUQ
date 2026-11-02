/**
 * Sky-map projections for the planetarium view (presentation only; no astronomy).
 *
 * Every projection is zenithal about the view centre: a direction at angular distance rho
 * from the centre lands at screen radius R(rho) in the direction of its azimuth around the
 * centre. The radial functions are the FITS celestial projections of Calabretta & Greisen
 * (2002), A&A 395, 1077, section 5.1 (Eqs. 56, 58, 61, 69, 71), written in units of the
 * generating sphere's radius: TAN tan(rho), STG 2 tan(rho/2), SIN sin(rho), ARC rho,
 * ZEA 2 sin(rho/2). Field-of-view limits follow Stellarium's projector classes
 * (StelProjectorClasses.hpp, getMaxFov).
 *
 * Frames: ENU is (east, north, up). The view frame has x to the right, y up and the view
 * centre along -z, so the same direction maps to the approved scene convention
 * (ENU to Three.js (east, up, -north)) when the camera faces north at the horizon.
 */

export type ProjectionId =
  'STEREOGRAPHIC' | 'PERSPECTIVE' | 'FISHEYE' | 'EQUAL_AREA' | 'ORTHOGRAPHIC';

export interface ProjectionDefinition {
  readonly id: ProjectionId;
  readonly label: string;
  /** FITS code (Calabretta & Greisen 2002). */
  readonly fitsCode: 'STG' | 'TAN' | 'ARC' | 'ZEA' | 'SIN';
  /** Numeric id used by the shaders. */
  readonly shaderIndex: number;
  /** Largest field of view (rad), as in Stellarium. */
  readonly maxFov: number;
  /** Largest angular distance from the centre that the projection can show (rad). */
  readonly maxRho: number;
  readonly forward: (rho: number) => number;
  readonly inverse: (r: number) => number | null;
}

const DEG = Math.PI / 180;

export const PROJECTIONS: Readonly<Record<ProjectionId, ProjectionDefinition>> = {
  STEREOGRAPHIC: {
    id: 'STEREOGRAPHIC',
    label: 'Stereographic',
    fitsCode: 'STG',
    shaderIndex: 0,
    maxFov: 235 * DEG,
    maxRho: 179 * DEG,
    forward: (rho) => 2 * Math.tan(rho / 2),
    inverse: (r) => 2 * Math.atan(r / 2),
  },
  PERSPECTIVE: {
    id: 'PERSPECTIVE',
    label: 'Perspective (gnomonic)',
    fitsCode: 'TAN',
    shaderIndex: 1,
    maxFov: 120 * DEG,
    maxRho: 89.5 * DEG,
    forward: (rho) => Math.tan(rho),
    inverse: (r) => Math.atan(r),
  },
  FISHEYE: {
    id: 'FISHEYE',
    label: 'Fisheye (equidistant)',
    fitsCode: 'ARC',
    shaderIndex: 2,
    maxFov: 360 * DEG,
    maxRho: 180 * DEG,
    forward: (rho) => rho,
    inverse: (r) => (r <= Math.PI ? r : null),
  },
  EQUAL_AREA: {
    id: 'EQUAL_AREA',
    label: 'Equal area',
    fitsCode: 'ZEA',
    shaderIndex: 3,
    maxFov: 360 * DEG,
    maxRho: 180 * DEG,
    forward: (rho) => 2 * Math.sin(rho / 2),
    inverse: (r) => (r <= 2 ? 2 * Math.asin(r / 2) : null),
  },
  ORTHOGRAPHIC: {
    id: 'ORTHOGRAPHIC',
    label: 'Orthographic',
    fitsCode: 'SIN',
    shaderIndex: 4,
    maxFov: 179.9999 * DEG,
    maxRho: 90 * DEG,
    forward: (rho) => Math.sin(Math.min(rho, Math.PI / 2)),
    inverse: (r) => (r <= 1 ? Math.asin(r) : null),
  },
};

export const MIN_FOV = 2 * DEG;

export type Vec3 = readonly [number, number, number];

export interface ViewState {
  /** Azimuth of the view centre: north 0, east positive (rad). */
  readonly azimuth: number;
  /** Altitude of the view centre (rad). */
  readonly altitude: number;
  /** Field of view across the smaller viewport dimension (rad). */
  readonly fov: number;
  readonly projection: ProjectionId;
}

/** Row-major 3x3 rotation from ENU to the view frame (rows: right, up, back). */
export function viewRotation(azimuth: number, altitude: number): number[] {
  const sa = Math.sin(azimuth);
  const ca = Math.cos(azimuth);
  const sh = Math.sin(altitude);
  const ch = Math.cos(altitude);
  const forward = [sa * ch, ca * ch, sh];
  const right = [ca, -sa, 0];
  // up = right x forward
  const up = [
    right[1]! * forward[2]! - right[2]! * forward[1]!,
    right[2]! * forward[0]! - right[0]! * forward[2]!,
    right[0]! * forward[1]! - right[1]! * forward[0]!,
  ];
  return [...right, ...up, -forward[0]!, -forward[1]!, -forward[2]!];
}

export function clampFov(fov: number, projection: ProjectionId): number {
  return Math.min(PROJECTIONS[projection].maxFov, Math.max(MIN_FOV, fov));
}

/** Pixels per unit of R for a viewport, so the field of view spans the smaller side. */
export function pixelScale(view: ViewState, width: number, height: number): number {
  const projection = PROJECTIONS[view.projection];
  const halfFov = Math.min(clampFov(view.fov, view.projection) / 2, projection.maxRho);
  return Math.min(width, height) / 2 / projection.forward(halfFov);
}

export interface Projector {
  /** Screen position (pixels from the centre, y up) or null when not representable. */
  readonly project: (enu: Vec3) => readonly [number, number] | null;
  /** ENU direction under a screen position (pixels from the centre, y up), or null. */
  readonly unproject: (x: number, y: number) => Vec3 | null;
  readonly scale: number;
}

export function createProjector(view: ViewState, width: number, height: number): Projector {
  const projection = PROJECTIONS[view.projection];
  const m = viewRotation(view.azimuth, view.altitude);
  const scale = pixelScale(view, width, height);
  return {
    scale,
    project: ([e, n, u]) => {
      const x = m[0]! * e + m[1]! * n + m[2]! * u;
      const y = m[3]! * e + m[4]! * n + m[5]! * u;
      const z = m[6]! * e + m[7]! * n + m[8]! * u;
      const rho = Math.acos(Math.max(-1, Math.min(1, -z)));
      if (rho > projection.maxRho) return null;
      const planar = Math.hypot(x, y);
      if (planar < 1e-12) return [0, 0];
      const r = projection.forward(rho) * scale;
      return [(x / planar) * r, (y / planar) * r];
    },
    unproject: (sx, sy) => {
      const r = Math.hypot(sx, sy) / scale;
      const rho = projection.inverse(r);
      if (rho === null || rho > projection.maxRho) return null;
      const planar = Math.hypot(sx, sy);
      const ux = planar === 0 ? 0 : sx / planar;
      const uy = planar === 0 ? 0 : sy / planar;
      const vx = Math.sin(rho) * ux;
      const vy = Math.sin(rho) * uy;
      const vz = -Math.cos(rho);
      // ENU = M^T v
      return [
        m[0]! * vx + m[3]! * vy + m[6]! * vz,
        m[1]! * vx + m[4]! * vy + m[7]! * vz,
        m[2]! * vx + m[5]! * vy + m[8]! * vz,
      ];
    },
  };
}

/** Altitude and azimuth (rad) of an ENU direction. */
export function altAz([e, n, u]: Vec3): { altitude: number; azimuth: number } {
  const azimuth = Math.atan2(e, n);
  return {
    altitude: Math.atan2(u, Math.hypot(e, n)),
    azimuth: azimuth < 0 ? azimuth + 2 * Math.PI : azimuth,
  };
}

export function directionFromAltAz(altitude: number, azimuth: number): Vec3 {
  return [
    Math.sin(azimuth) * Math.cos(altitude),
    Math.cos(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
  ];
}

/** Unit vectors along the great circle from a to b, at most `stepRadians` apart. */
export function greatCircle(a: Vec3, b: Vec3, stepRadians = 1.5 * DEG): Vec3[] {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-9) return [a, b];
  const steps = Math.max(1, Math.ceil(omega / stepRadians));
  const sinOmega = Math.sin(omega);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const wa = Math.sin((1 - t) * omega) / sinOmega;
    const wb = Math.sin(t * omega) / sinOmega;
    return [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]] as const;
  });
}

/** The normalised mean of directions (a label anchor for a figure). */
export function meanDirection(directions: readonly Vec3[]): Vec3 | null {
  let e = 0;
  let n = 0;
  let u = 0;
  for (const d of directions) {
    e += d[0];
    n += d[1];
    u += d[2];
  }
  const length = Math.hypot(e, n, u);
  return length < 1e-9 ? null : [e / length, n / length, u / length];
}
