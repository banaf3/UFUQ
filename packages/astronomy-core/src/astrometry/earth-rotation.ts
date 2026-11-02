/*
 * UFUQ derived work: uses routines and computations derived from IAU SOFA 2023-10-11
 * (era00, sp00, pom00, gd2gce, pvtob, epv00, dtdb); not software provided by or
 * endorsed by SOFA. Differences: values are returned instead of written through
 * pointers; `observerPositionVelocity` takes the declared ellipsoid (equatorial radius
 * and flattening) explicitly instead of `iauPvtob`'s embedded WGS 84 call, and returns a
 * status instead of ignoring it; `earthPositionVelocity` returns the `epv00` status with
 * the result. See SOFA_DERIVED_NOTICE.md.
 */
import { D2PI, DAS2R, DAYSEC, DD2R, DJ00, DJC, DJM, DJY } from './constants.js';
import {
  EPV_E0X,
  EPV_E0Y,
  EPV_E0Z,
  EPV_E1X,
  EPV_E1Y,
  EPV_E1Z,
  EPV_E2X,
  EPV_E2Y,
  EPV_E2Z,
  EPV_S0X,
  EPV_S0Y,
  EPV_S0Z,
  EPV_S1X,
  EPV_S1Y,
  EPV_S1Z,
  EPV_S2X,
  EPV_S2Y,
  EPV_S2Z,
} from './tables/earth-ephemeris-vsop2000-series.js';
import { FAIRHEAD_TDB_TERMS } from './tables/tdb-tt-fairhead-series.js';
import {
  IDENTITY_MATRIX,
  type Mat3,
  normalizeAnglePositive,
  type PosVel,
  rotateX,
  rotateY,
  rotateZ,
  transposeTimesVector,
  type Vec3,
} from './vector.js';

/** SOFA `iauEra00`: Earth rotation angle (IAU 2000) from a two-part UT1 Julian Date. */
export function earthRotationAngle(dj1: number, dj2: number): number {
  let d1: number;
  let d2: number;
  if (dj1 < dj2) {
    d1 = dj1;
    d2 = dj2;
  } else {
    d1 = dj2;
    d2 = dj1;
  }
  const t = d1 + (d2 - DJ00);
  const f = (d1 % 1.0) + (d2 % 1.0);
  return normalizeAnglePositive(D2PI * (f + 0.779057273264 + 0.00273781191135448 * t));
}

/** SOFA `iauSp00`: TIO locator s', from a two-part TT Julian Date. */
export function tioLocator(date1: number, date2: number): number {
  const t = (date1 - DJ00 + date2) / DJC;
  return -47e-6 * t * DAS2R;
}

/** SOFA `iauPom00`: polar-motion matrix from xp, yp (radians) and s'. */
export function polarMotionMatrix(xp: number, yp: number, sp: number): Mat3 {
  let r = IDENTITY_MATRIX;
  r = rotateZ(sp, r);
  r = rotateY(-xp, r);
  r = rotateX(-yp, r);
  return r;
}

export type GeodeticToGeocentricResult =
  | { readonly status: 0; readonly xyz: Vec3 }
  | { readonly status: -1; readonly reason: 'ILLEGAL_FLATTENING' };

/** SOFA `iauGd2gce`: geodetic to geocentric for an explicitly supplied ellipsoid. */
export function geodeticToGeocentric(
  a: number,
  f: number,
  elong: number,
  phi: number,
  height: number,
): GeodeticToGeocentricResult {
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  let w = 1.0 - f;
  w = w * w;
  const d = cp * cp + w * sp * sp;
  if (d <= 0.0) return { status: -1, reason: 'ILLEGAL_FLATTENING' };
  const ac = a / Math.sqrt(d);
  const as = w * ac;
  const r = (ac + height) * cp;
  return { status: 0, xyz: [r * Math.cos(elong), r * Math.sin(elong), (as + height) * sp] };
}

export type ObserverPositionVelocityResult =
  | { readonly status: 0; readonly pv: PosVel }
  | { readonly status: -1; readonly reason: 'ILLEGAL_FLATTENING' };

/**
 * Derived from SOFA `iauPvtob`: position/velocity of a terrestrial observer with respect
 * to the CIRS (m, m/s). The ellipsoid is supplied explicitly (see module notice).
 */
export function observerPositionVelocity(
  ellipsoid: { readonly equatorialRadiusMetres: number; readonly flattening: number },
  elong: number,
  phi: number,
  hm: number,
  xp: number,
  yp: number,
  sp: number,
  theta: number,
): ObserverPositionVelocityResult {
  const OM = (1.00273781191135448 * D2PI) / DAYSEC;
  const geocentric = geodeticToGeocentric(
    ellipsoid.equatorialRadiusMetres,
    ellipsoid.flattening,
    elong,
    phi,
    hm,
  );
  if (geocentric.status !== 0) return geocentric;
  const rpm = polarMotionMatrix(xp, yp, sp);
  const [x, y, z] = transposeTimesVector(rpm, geocentric.xyz);
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  return {
    status: 0,
    pv: [
      [c * x - s * y, s * x + c * y, z],
      [OM * (-s * x - c * y), OM * (c * x - s * y), 0.0],
    ],
  };
}

export interface EarthPositionVelocity {
  /** 0 = OK; 1 = date outside 1900-2100 (SOFA epv00 warning). */
  readonly status: 0 | 1;
  /** Heliocentric Earth position/velocity, BCRS (au, au/day). */
  readonly heliocentric: PosVel;
  /** Barycentric Earth position/velocity, BCRS (au, au/day). */
  readonly barycentric: PosVel;
}

function sumSeries0(table: readonly number[], t: number): [number, number] {
  let xyz = 0.0;
  let xyzd = 0.0;
  for (let j = 0; j < table.length; j += 3) {
    const a = table[j] as number;
    const b = table[j + 1] as number;
    const c = table[j + 2] as number;
    const p = b + c * t;
    xyz += a * Math.cos(p);
    xyzd -= a * c * Math.sin(p);
  }
  return [xyz, xyzd];
}

function sumSeries1(table: readonly number[], t: number, xyz0: number, xyzd0: number) {
  let xyz = xyz0;
  let xyzd = xyzd0;
  for (let j = 0; j < table.length; j += 3) {
    const a = table[j] as number;
    const b = table[j + 1] as number;
    const c = table[j + 2] as number;
    const ct = c * t;
    const p = b + ct;
    const cp = Math.cos(p);
    xyz += a * t * cp;
    xyzd += a * (cp - ct * Math.sin(p));
  }
  return [xyz, xyzd] as const;
}

function sumSeries2(table: readonly number[], t: number, xyz0: number, xyzd0: number) {
  const t2 = t * t;
  let xyz = xyz0;
  let xyzd = xyzd0;
  for (let j = 0; j < table.length; j += 3) {
    const a = table[j] as number;
    const b = table[j + 1] as number;
    const c = table[j + 2] as number;
    const ct = c * t;
    const p = b + ct;
    const cp = Math.cos(p);
    xyz += a * t2 * cp;
    xyzd += a * t * (2.0 * cp - ct * Math.sin(p));
  }
  return [xyz, xyzd] as const;
}

function continueSeries0(table: readonly number[], t: number, xyz0: number, xyzd0: number) {
  let xyz = xyz0;
  let xyzd = xyzd0;
  for (let j = 0; j < table.length; j += 3) {
    const a = table[j] as number;
    const b = table[j + 1] as number;
    const c = table[j + 2] as number;
    const p = b + c * t;
    xyz += a * Math.cos(p);
    xyzd -= a * c * Math.sin(p);
  }
  return [xyz, xyzd] as const;
}

const EARTH_SERIES = [
  [EPV_E0X, EPV_E1X, EPV_E2X],
  [EPV_E0Y, EPV_E1Y, EPV_E2Y],
  [EPV_E0Z, EPV_E1Z, EPV_E2Z],
] as const;
const SUN_SERIES = [
  [EPV_S0X, EPV_S1X, EPV_S2X],
  [EPV_S0Y, EPV_S1Y, EPV_S2Y],
  [EPV_S0Z, EPV_S1Z, EPV_S2Z],
] as const;

/** SOFA `iauEpv00`: Earth position and velocity, heliocentric and barycentric (BCRS). */
export function earthPositionVelocity(date1: number, date2: number): EarthPositionVelocity {
  const am12 = 0.000000211284;
  const am13 = -0.000000091603;
  const am21 = -0.000000230286;
  const am22 = 0.917482137087;
  const am23 = -0.397776982902;
  const am32 = 0.397776982902;
  const am33 = 0.917482137087;

  const t = (date1 - DJ00 + date2) / DJY;
  const status: 0 | 1 = Math.abs(t) <= 100.0 ? 0 : 1;
  const ph: number[] = [];
  const vh: number[] = [];
  const pb: number[] = [];
  const vb: number[] = [];
  for (let i = 0; i < 3; i++) {
    const [e0, e1, e2] = EARTH_SERIES[i as 0 | 1 | 2];
    const [s0, s1, s2] = SUN_SERIES[i as 0 | 1 | 2];
    let [xyz, xyzd] = sumSeries0(e0, t);
    [xyz, xyzd] = sumSeries1(e1, t, xyz, xyzd);
    [xyz, xyzd] = sumSeries2(e2, t, xyz, xyzd);
    ph[i] = xyz;
    vh[i] = xyzd / DJY;
    [xyz, xyzd] = continueSeries0(s0, t, xyz, xyzd);
    [xyz, xyzd] = sumSeries1(s1, t, xyz, xyzd);
    [xyz, xyzd] = sumSeries2(s2, t, xyz, xyzd);
    pb[i] = xyz;
    vb[i] = xyzd / DJY;
  }
  const rotate = (v: number[]): Vec3 => {
    const x = v[0] as number;
    const y = v[1] as number;
    const z = v[2] as number;
    return [x + am12 * y + am13 * z, am21 * x + am22 * y + am23 * z, am32 * y + am33 * z];
  };
  return {
    status,
    heliocentric: [rotate(ph), rotate(vh)],
    barycentric: [rotate(pb), rotate(vb)],
  };
}

/**
 * SOFA `iauDtdb`: TDB-TT (seconds), Fairhead & Bretagnon 1990 model. `ut` is the UT1
 * fraction of a day, `elong` east longitude (rad), `u` distance from the Earth spin axis
 * (km), `v` distance north of the equatorial plane (km). With u = v = 0 the result is
 * the geocentric value and `ut`/`elong` have no effect.
 */
export function tdbMinusTt(
  date1: number,
  date2: number,
  ut: number,
  elong: number,
  u: number,
  v: number,
): number {
  const t = (date1 - DJ00 + date2) / DJM;
  const tsol = (ut % 1.0) * D2PI + elong;
  let w = t / 3600.0;
  const elsun = ((280.46645683 + 1296027711.03429 * w) % 360.0) * DD2R;
  const emsun = ((357.52910918 + 1295965810.481 * w) % 360.0) * DD2R;
  const d = ((297.85019547 + 16029616012.09 * w) % 360.0) * DD2R;
  const elj = ((34.35151874 + 109306899.89453 * w) % 360.0) * DD2R;
  const els = ((50.0774443 + 44046398.47038 * w) % 360.0) * DD2R;
  const wt =
    +0.00029e-10 * u * Math.sin(tsol + elsun - els) +
    0.001e-10 * u * Math.sin(tsol - 2.0 * emsun) +
    0.00133e-10 * u * Math.sin(tsol - d) +
    0.00133e-10 * u * Math.sin(tsol + elsun - elj) -
    0.00229e-10 * u * Math.sin(tsol + 2.0 * elsun + emsun) -
    0.022e-10 * v * Math.cos(elsun + emsun) +
    0.05312e-10 * u * Math.sin(tsol - emsun) -
    0.13677e-10 * u * Math.sin(tsol + 2.0 * elsun) -
    1.3184e-10 * v * Math.cos(elsun) +
    3.17679e-10 * u * Math.sin(tsol);
  const series = (from: number, to: number): number => {
    let sum = 0;
    for (let j = from; j >= to; j--) {
      const o = j * 3;
      sum +=
        (FAIRHEAD_TDB_TERMS[o] as number) *
        Math.sin((FAIRHEAD_TDB_TERMS[o + 1] as number) * t + (FAIRHEAD_TDB_TERMS[o + 2] as number));
    }
    return sum;
  };
  const w0 = series(473, 0);
  const w1 = series(678, 474);
  const w2 = series(763, 679);
  const w3 = series(783, 764);
  const w4 = series(786, 784);
  const wf = t * (t * (t * (t * w4 + w3) + w2) + w1) + w0;
  const wj =
    0.00065e-6 * Math.sin(6069.776754 * t + 4.021194) +
    0.00033e-6 * Math.sin(213.299095 * t + 5.543132) +
    -0.00196e-6 * Math.sin(6208.294251 * t + 5.696701) +
    -0.00173e-6 * Math.sin(74.781599 * t + 2.4359) +
    0.03638e-6 * t * t;
  w = wt + wf + wj;
  return w;
}
