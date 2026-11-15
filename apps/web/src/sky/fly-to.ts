/**
 * Smooth camera flights between two sky views, after J. J. van Wijk and W. A. A. Nuij,
 * "Smooth and efficient zooming and panning", IEEE InfoVis 2003 (the method of d3's
 * interpolateZoom and of map "fly to" animations). A flight zooms out while it pans a long
 * way and zooms back in at the end, so the learner keeps the context of where the camera
 * is going. On the sphere the pan distance u is the angle between the two view centres and
 * the zoom width w is the field of view; the centre moves along the great circle between
 * them. rho = sqrt(2) is the paper's recommended trade-off (also d3's default).
 */
import { altAz, directionFromAltAz, type Vec3, type ViewState } from './projection.js';

const RHO = Math.SQRT2;
const RHO2 = 2;
const RHO4 = 4;
const EPSILON = 1e-6;

export interface Flight {
  /** View at t in [0, 1]. */
  readonly at: (t: number) => ViewState;
  /** Path length S in the paper's units, for choosing a duration. */
  readonly length: number;
  /** Suggested duration (ms): proportional to S, as in d3, within comfortable bounds. */
  readonly durationMs: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function slerp(a: Vec3, b: Vec3, angle: number, fraction: number): Vec3 {
  if (angle < EPSILON) return a;
  const sin = Math.sin(angle);
  const wa = Math.sin((1 - fraction) * angle) / sin;
  const wb = Math.sin(fraction * angle) / sin;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
}

/** Cubic ease-in-out (d3's default transition easing). */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function flyPath(from: ViewState, to: ViewState, maximumFov = Math.PI): Flight {
  const a = directionFromAltAz(from.altitude, from.azimuth);
  const b = directionFromAltAz(to.altitude, to.azimuth);
  const u1 = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  const w0 = from.fov;
  const w1 = to.fov;
  let length: number;
  let progress: (s: number) => { u: number; w: number };
  if (u1 < EPSILON) {
    // Pure zoom: w changes exponentially with s.
    length = Math.abs(Math.log(w1 / w0)) / RHO;
    const sign = w1 > w0 ? 1 : -1;
    progress = (s) => ({ u: 0, w: w0 * Math.exp(sign * RHO * s) });
  } else {
    const b0 = (w1 * w1 - w0 * w0 + RHO4 * u1 * u1) / (2 * w0 * RHO2 * u1);
    const b1 = (w1 * w1 - w0 * w0 - RHO4 * u1 * u1) / (2 * w1 * RHO2 * u1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    length = (r1 - r0) / RHO;
    progress = (s) => {
      const coshR0 = Math.cosh(r0);
      return {
        u: (w0 / RHO2) * coshR0 * Math.tanh(RHO * s + r0) - (w0 / RHO2) * Math.sinh(r0),
        w: (w0 * coshR0) / Math.cosh(RHO * s + r0),
      };
    };
  }
  const at = (t: number): ViewState => {
    if (t <= 0) return from;
    if (t >= 1) return to;
    const { u, w } = progress(easeInOutCubic(t) * length);
    const centre = slerp(a, b, u1, u1 < EPSILON ? 0 : Math.min(1, Math.max(0, u / u1)));
    const { altitude, azimuth } = altAz(centre);
    // Near the zenith the azimuth is undefined; keep the start's to avoid a spin.
    const steady = Math.cos(altitude) < 1e-4;
    return {
      projection: to.projection,
      altitude,
      azimuth: steady ? from.azimuth : azimuth,
      fov: Math.min(maximumFov, w),
    };
  };
  return {
    at,
    length,
    durationMs: Math.min(4000, Math.max(700, 900 * length)),
  };
}
