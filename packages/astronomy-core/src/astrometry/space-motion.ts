/*
 * UFUQ derived work: uses routines and computations derived from IAU SOFA 2023-10-11
 * (starpv, pvstar, starpm, pmsafe); not software provided by or endorsed by SOFA.
 * Differences: the routines return an object carrying the SOFA status code together
 * with the result instead of writing through pointers. No status bit is dropped. See
 * SOFA_DERIVED_NOTICE.md.
 */
import { DAU, DAYSEC, DC, DJY, DR2AS } from './constants.js';
import {
  add,
  dot,
  modulus,
  normalize,
  normalizeAnglePositive,
  type PosVel,
  posVelToSpherical,
  scale,
  separationOfSpherical,
  sphericalToPosVel,
  subtract,
  updatePosVel,
  ZERO_VECTOR,
} from './vector.js';

export interface CatalogueSpaceMotionState {
  /** Right ascension (rad). */
  readonly ra: number;
  /** Declination (rad). */
  readonly dec: number;
  /** RA proper motion as a coordinate rate dRA/dt (rad per Julian year), not mu_alpha_star. */
  readonly pmr: number;
  /** Dec proper motion (rad per Julian year). */
  readonly pmd: number;
  /** Parallax (arcsec). */
  readonly px: number;
  /** Radial velocity (km/s, positive receding). */
  readonly rv: number;
}

/**
 * SOFA `iauStarpv`: catalogue coordinates to position+velocity (au, au/day). Status
 * bits: 1 = distance overridden, 2 = excessive speed, 4 = solution did not converge.
 */
export function catalogueToPosVel(star: CatalogueSpaceMotionState): {
  readonly status: number;
  readonly pv: PosVel;
} {
  const PXMIN = 1e-7;
  const VMAX = 0.5;
  const IMAX = 100;
  let w: number;
  let iwarn: number;
  if (star.px >= PXMIN) {
    w = star.px;
    iwarn = 0;
  } else {
    w = PXMIN;
    iwarn = 1;
  }
  const r = DR2AS / w;
  const rd = (DAYSEC * star.rv * 1e3) / DAU;
  const rad = star.pmr / DJY;
  const decd = star.pmd / DJY;
  let pv = sphericalToPosVel(star.ra, star.dec, r, rad, decd, rd);
  const v = modulus(pv[1]);
  if (v / DC > VMAX) {
    pv = [pv[0], ZERO_VECTOR];
    iwarn += 2;
  }
  const { u: pu } = normalize(pv[0]);
  const vsr = dot(pu, pv[1]);
  const usr = scale(vsr, pu);
  const ust = subtract(pv[1], usr);
  const vst = modulus(ust);
  const betsr = vsr / DC;
  const betst = vst / DC;
  let bett = betst;
  let betr = betsr;
  let d = 0.0;
  let del = 0.0;
  let odd = 0.0;
  let oddel = 0.0;
  let od = 0.0;
  let odel = 0.0;
  let i: number;
  for (i = 0; i < IMAX; i++) {
    d = 1.0 + betr;
    w = betr * betr + bett * bett;
    del = -w / (Math.sqrt(1.0 - w) + 1.0);
    betr = d * betsr + del;
    bett = d * betst;
    if (i > 0) {
      const dd = Math.abs(d - od);
      const ddel = Math.abs(del - odel);
      if (i > 1 && dd >= odd && ddel >= oddel) break;
      odd = dd;
      oddel = ddel;
    }
    od = d;
    odel = del;
  }
  if (i >= IMAX) iwarn += 4;
  const ut = scale(d, ust);
  const ur = scale(DC * (d * betsr + del), pu);
  return { status: iwarn, pv: [pv[0], add(ur, ut)] };
}

/**
 * SOFA `iauPvstar`: position+velocity (au, au/day) to catalogue coordinates.
 * Status: 0 OK, -1 superluminal speed, -2 null position vector.
 */
export function posVelToCatalogue(
  pvIn: PosVel,
): { readonly status: 0; readonly star: CatalogueSpaceMotionState } | { readonly status: -1 | -2 } {
  const { u: pu } = normalize(pvIn[0]);
  const vr = dot(pu, pvIn[1]);
  const ur = scale(vr, pu);
  const ut = subtract(pvIn[1], ur);
  const vt = modulus(ut);
  const bett = vt / DC;
  const betr = vr / DC;
  const d = 1.0 + betr;
  const w = betr * betr + bett * bett;
  if (d === 0.0 || w > 1.0) return { status: -1 };
  const del = -w / (Math.sqrt(1.0 - w) + 1.0);
  const ust = scale(1.0 / d, ut);
  const usr = scale((DC * (betr - del)) / d, pu);
  const pv: PosVel = [pvIn[0], add(usr, ust)];
  const { theta: a, phi: dec, r, td: rad, pd: decd, rd } = posVelToSpherical(pv);
  if (r === 0.0) return { status: -2 };
  return {
    status: 0,
    star: {
      ra: normalizeAnglePositive(a),
      dec,
      pmr: rad * DJY,
      pmd: decd * DJY,
      px: DR2AS / r,
      rv: (1e-3 * rd * DAU) / DAYSEC,
    },
  };
}

/**
 * SOFA `iauStarpm`: update star catalogue data for space motion between two TDB epochs
 * (each a two-part Julian Date). Status: -1 system error, 0 OK, or the `starpv` bits.
 */
export function propagateStar(
  star: CatalogueSpaceMotionState,
  ep1a: number,
  ep1b: number,
  ep2a: number,
  ep2b: number,
): { readonly status: number; readonly star?: CatalogueSpaceMotionState } {
  const { status: j1, pv: pv1 } = catalogueToPosVel(star);
  const tl1 = modulus(pv1[0]) / DC;
  const dt = ep2a - ep1a + (ep2b - ep1b);
  const pv = updatePosVel(dt + tl1, pv1);
  const r2 = dot(pv[0], pv[0]);
  const rdv = dot(pv[0], pv[1]);
  const v2 = dot(pv[1], pv[1]);
  const c2mv2 = DC * DC - v2;
  if (c2mv2 <= 0.0) return { status: -1 };
  const tl2 = (-rdv + Math.sqrt(rdv * rdv + c2mv2 * r2)) / c2mv2;
  const pv2 = updatePosVel(dt + (tl1 - tl2), pv1);
  const converted = posVelToCatalogue(pv2);
  if (converted.status !== 0) return { status: -1 };
  return { status: j1, star: converted.star };
}

/**
 * SOFA `iauPmsafe`: star proper motion with guards against small or negative parallax.
 * Status: -1 system error, 0 OK, 1 distance overridden, 2 excessive velocity, 4
 * non-convergence (sums possible). V1 treats any nonzero status as a fail-closed result.
 */
export function propagateStarSafely(
  star: CatalogueSpaceMotionState,
  ep1a: number,
  ep1b: number,
  ep2a: number,
  ep2b: number,
): { readonly status: number; readonly star?: CatalogueSpaceMotionState } {
  const PXMIN = 5e-7;
  const F = 326.0;
  let pm = separationOfSpherical(star.ra, star.dec, star.ra + star.pmr, star.dec + star.pmd);
  let jpx = 0;
  let px1a = star.px;
  pm *= F;
  if (px1a < pm) {
    jpx = 1;
    px1a = pm;
  }
  if (px1a < PXMIN) {
    jpx = 1;
    px1a = PXMIN;
  }
  const result = propagateStar({ ...star, px: px1a }, ep1a, ep1b, ep2a, ep2b);
  let j = result.status;
  if (j % 2 === 0) j += jpx;
  return result.star === undefined ? { status: j } : { status: j, star: result.star };
}
