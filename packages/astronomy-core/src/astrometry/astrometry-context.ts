/*
 * UFUQ derived work: uses routines and computations derived from IAU SOFA 2023-10-11
 * (apcs, apco, pmpx, ld, ldsun, ab, atciq, atioq); not software provided by or endorsed
 * by SOFA. Differences: (1) the context object carries no refraction constants; (2) the
 * diurnal-aberration term is fixed at zero as `iauApco` sets it, because the observer
 * velocity already carries it; (3) the observer state comes from
 * `observerPositionVelocity` with an explicit ellipsoid instead of `iauPvtob`'s WGS 84
 * default; (4) `cirsToGeometricHorizontal` implements only the geometric part of
 * `iauAtioq` (the refraction section and its numerical guards are not ported) and
 * reports the exact zenith/nadir case as an undefined azimuth instead of SOFA's 0.0;
 * (5) values are returned instead of written through pointers. See
 * SOFA_DERIVED_NOTICE.md.
 */
import { AULT, DAS2R, DAU, DAYSEC, DJ00, DJM, DJY, SRS } from './constants.js';
import { observerPositionVelocity } from './earth-rotation.js';
import { celestialToIntermediateMatrix } from './precession-nutation.js';
import {
  add,
  cartesianToSpherical,
  cross,
  dot,
  IDENTITY_MATRIX,
  type Mat3,
  matrixTimesVector,
  normalize,
  normalizeAnglePositive,
  normalizeAngleSigned,
  type PosVel,
  rotateX,
  rotateY,
  rotateZ,
  sphericalToCartesian,
  transposeTimesPosVel,
  type Vec3,
} from './vector.js';

/** Star-independent astrometry parameters (SOFA `iauASTROM`, without refraction fields). */
export interface ObserverAstrometryContext {
  /** PM time interval, Julian years since J2000.0 (SSB). */
  readonly pmt: number;
  /** SSB to observer, BCRS (au). */
  readonly eb: Vec3;
  /** Sun to observer, unit vector. */
  readonly eh: Vec3;
  /** Distance from Sun to observer (au). */
  readonly em: number;
  /** Barycentric observer velocity (units of c). */
  readonly v: Vec3;
  /** sqrt(1 - |v|^2): reciprocal of the Lorenz factor. */
  readonly bm1: number;
  /** Bias-precession-nutation matrix (celestial-to-intermediate). */
  readonly bpn: Mat3;
  /** Longitude + s' + dERA(DUT) (rad). */
  readonly along: number;
  /** Polar motion xp with respect to the local meridian (rad). */
  readonly xpl: number;
  /** Polar motion yp with respect to the local meridian (rad). */
  readonly ypl: number;
  readonly sphi: number;
  readonly cphi: number;
  /** Diurnal aberration term: fixed at zero (carried by observer velocity). */
  readonly diurab: 0;
  /** "Local" Earth rotation angle (rad). */
  readonly eral: number;
}

/** SOFA `iauApcs`: space-motion/aberration/deflection context for an observer pv (GCRS, m, m/s). A zero pv gives the geocentric case. */
export function contextFromObserverState(
  date1: number,
  date2: number,
  pv: PosVel,
  ebpv: PosVel,
  ehp: Vec3,
): Pick<ObserverAstrometryContext, 'pmt' | 'eb' | 'eh' | 'em' | 'v' | 'bm1'> {
  const AUDMS = DAU / DAYSEC;
  const CR = AULT / DAYSEC;
  const pb: number[] = [];
  const vb: number[] = [];
  const ph: number[] = [];
  for (let i = 0; i < 3; i++) {
    const k = i as 0 | 1 | 2;
    const dp = pv[0][k] / DAU;
    const dv = pv[1][k] / AUDMS;
    pb[i] = ebpv[0][k] + dp;
    vb[i] = ebpv[1][k] + dv;
    ph[i] = ehp[k] + dp;
  }
  const { r: em, u: eh } = normalize(ph as unknown as Vec3);
  let v2 = 0.0;
  const v: number[] = [];
  for (let i = 0; i < 3; i++) {
    const w = (vb[i] as number) * CR;
    v[i] = w;
    v2 += w * w;
  }
  return {
    pmt: (date1 - DJ00 + date2) / DJY,
    eb: pb as unknown as Vec3,
    eh,
    em,
    v: v as unknown as Vec3,
    bm1: Math.sqrt(1.0 - v2),
  };
}

export interface ObserverContextInput {
  /** TDB (TT acceptable, as in `iauApco13`) as a two-part Julian Date. */
  readonly date1: number;
  readonly date2: number;
  /** Earth barycentric position/velocity (au, au/day). */
  readonly ebpv: PosVel;
  /** Earth heliocentric position (au). */
  readonly ehp: Vec3;
  /** CIP X,Y and CIO locator s. */
  readonly x: number;
  readonly y: number;
  readonly s: number;
  /** Earth rotation angle (rad). */
  readonly theta: number;
  /** Observer geodetic longitude (east positive), latitude (rad), ellipsoidal height (m). */
  readonly elong: number;
  readonly phi: number;
  readonly hm: number;
  readonly ellipsoid: { readonly equatorialRadiusMetres: number; readonly flattening: number };
  /** Polar motion (rad) and TIO locator s' (rad). */
  readonly xp: number;
  readonly yp: number;
  readonly sp: number;
}

/** Derived from SOFA `iauApco` with no refraction constants (see module notice). */
export function observerAstrometryContext(
  input: ObserverContextInput,
):
  | { readonly status: 0; readonly context: ObserverAstrometryContext }
  | { readonly status: -1; readonly reason: 'ILLEGAL_FLATTENING' } {
  let r = IDENTITY_MATRIX;
  r = rotateZ(input.theta + input.sp, r);
  r = rotateY(-input.xp, r);
  r = rotateX(-input.yp, r);
  r = rotateZ(input.elong, r);
  let a = r[0][0];
  let b = r[0][1];
  const eral = a !== 0.0 || b !== 0.0 ? Math.atan2(b, a) : 0.0;
  a = r[0][0];
  const c = r[0][2];
  const xpl = Math.atan2(c, Math.sqrt(a * a + b * b));
  a = r[1][2];
  b = r[2][2];
  const ypl = a !== 0.0 || b !== 0.0 ? -Math.atan2(a, b) : 0.0;
  const along = normalizeAngleSigned(eral - input.theta);

  const c2i = celestialToIntermediateMatrix(input.x, input.y, input.s);
  const observer = observerPositionVelocity(
    input.ellipsoid,
    input.elong,
    input.phi,
    input.hm,
    input.xp,
    input.yp,
    input.sp,
    input.theta,
  );
  if (observer.status !== 0) return observer;
  const pv = transposeTimesPosVel(c2i, observer.pv);
  const motion = contextFromObserverState(input.date1, input.date2, pv, input.ebpv, input.ehp);
  return {
    status: 0,
    context: {
      ...motion,
      bpn: c2i,
      along,
      xpl,
      ypl,
      sphi: Math.sin(input.phi),
      cphi: Math.cos(input.phi),
      diurab: 0,
      eral,
    },
  };
}

/** SOFA `iauPmpx`: proper motion and parallax, giving the coordinate direction (unit vector). */
export function properMotionAndParallax(
  rc: number,
  dc: number,
  pr: number,
  pd: number,
  px: number,
  rv: number,
  pmt: number,
  pob: Vec3,
): Vec3 {
  const VF = (DAYSEC * DJM) / DAU;
  const AULTY = AULT / DAYSEC / DJY;
  const sr = Math.sin(rc);
  const cr = Math.cos(rc);
  const sd = Math.sin(dc);
  const cd = Math.cos(dc);
  const x = cr * cd;
  const y = sr * cd;
  const z = sd;
  const p: Vec3 = [x, y, z];
  const dt = pmt + dot(p, pob) * AULTY;
  const pxr = px * DAS2R;
  const w = VF * rv * pxr;
  const pdz = pd * z;
  const pm: Vec3 = [-pr * y - pdz * cr + w * x, pr * x - pdz * sr + w * y, pd * cd + w * z];
  const moved: Vec3 = [
    p[0] + (dt * pm[0] - pxr * pob[0]),
    p[1] + (dt * pm[1] - pxr * pob[1]),
    p[2] + (dt * pm[2] - pxr * pob[2]),
  ];
  return normalize(moved).u;
}

/** SOFA `iauLd`: light deflection by a single solar-system body. */
export function lightDeflection(
  bm: number,
  p: Vec3,
  q: Vec3,
  e: Vec3,
  em: number,
  dlim: number,
): Vec3 {
  const qpe = add(q, e);
  const qdqpe = dot(q, qpe);
  const w = (bm * SRS) / em / Math.max(qdqpe, dlim);
  const eq = cross(e, q);
  const peq = cross(p, eq);
  return [p[0] + w * peq[0], p[1] + w * peq[1], p[2] + w * peq[2]];
}

/** SOFA `iauLdsun`: deflection of starlight by the Sun. */
export function solarLightDeflection(p: Vec3, e: Vec3, em: number): Vec3 {
  let em2 = em * em;
  if (em2 < 1.0) em2 = 1.0;
  const dlim = 1e-6 / (em2 > 1.0 ? em2 : 1.0);
  return lightDeflection(1.0, p, p, e, em, dlim);
}

/** SOFA `iauAb`: stellar aberration (proper direction from natural direction). */
export function aberration(pnat: Vec3, v: Vec3, s: number, bm1: number): Vec3 {
  const pdv = dot(pnat, v);
  const w1 = 1.0 + pdv / (1.0 + bm1);
  const w2 = SRS / s;
  let r2 = 0.0;
  const p: number[] = [];
  for (let i = 0; i < 3; i++) {
    const k = i as 0 | 1 | 2;
    const w = pnat[k] * bm1 + w1 * v[k] + w2 * (v[k] - pdv * pnat[k]);
    p[i] = w;
    r2 = r2 + w * w;
  }
  const r = Math.sqrt(r2);
  return [(p[0] as number) / r, (p[1] as number) / r, (p[2] as number) / r];
}

/**
 * SOFA `iauAtciq`: quick ICRS (epoch J2000.0) to CIRS, with proper motion, parallax,
 * radial velocity, solar deflection and aberration. `pr` is dRA/dt (rad/yr), `px`
 * parallax (arcsec), `rv` radial velocity (km/s, positive receding).
 */
export function icrsToCirs(
  rc: number,
  dc: number,
  pr: number,
  pd: number,
  px: number,
  rv: number,
  context: ObserverAstrometryContext,
): { readonly ri: number; readonly di: number } {
  const pco = properMotionAndParallax(rc, dc, pr, pd, px, rv, context.pmt, context.eb);
  const pnat = solarLightDeflection(pco, context.eh, context.em);
  const ppr = aberration(pnat, context.v, context.em, context.bm1);
  const pi = matrixTimesVector(context.bpn, ppr);
  const { theta: w, phi: di } = cartesianToSpherical(pi);
  return { ri: normalizeAnglePositive(w), di };
}

export interface GeometricHorizontalVector {
  /** East, north, up components of the unit direction. */
  readonly enu: Vec3;
  /** Signed geometric altitude (rad). */
  readonly altitude: number;
  /** Azimuth, north zero and east positive, in [0, 2pi) (rad); null at exact zenith/nadir. */
  readonly azimuth: number | null;
}

/**
 * Geometric part of SOFA `iauAtioq`: CIRS to local horizontal without refraction. The
 * diurnal aberration term is zero (`astrom->diurab = 0`), so the scaling factor is 1.
 */
export function cirsToGeometricHorizontal(
  ri: number,
  di: number,
  context: ObserverAstrometryContext,
): GeometricHorizontalVector {
  const [x, y, z] = sphericalToCartesian(ri - context.eral, di);
  const sx = Math.sin(context.xpl);
  const cx = Math.cos(context.xpl);
  const sy = Math.sin(context.ypl);
  const cy = Math.cos(context.ypl);
  const xhd = cx * x + sx * z;
  const yhd = sx * sy * x + cy * y - cx * sy * z;
  const zhd = -sx * cy * x + sy * y + cx * cy * z;
  // diurab = 0: f = 1 and no diurnal shift (UFUQ: term disabled as redundant).
  const xhdt = xhd;
  const yhdt = yhd;
  const zhdt = zhd;
  const xaet = context.sphi * xhdt - context.cphi * zhdt;
  const yaet = yhdt;
  const zaet = context.cphi * xhdt + context.sphi * zhdt;
  const horizontal = Math.sqrt(xaet * xaet + yaet * yaet);
  const azimuth =
    xaet !== 0.0 || yaet !== 0.0 ? normalizeAnglePositive(Math.atan2(yaet, -xaet)) : null;
  const altitude = Math.atan2(zaet, horizontal);
  const { u: enu } = normalize([yaet, -xaet, zaet]);
  return { enu, altitude, azimuth };
}
