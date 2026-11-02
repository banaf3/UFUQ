/*
 * UFUQ derived work: uses routines and computations derived from IAU SOFA 2023-10-11
 * (anp, anpm, s2c, c2s, s2pv, pv2s, pm, pn, pdp, pxp, sxp, ppp, pmp, ppsp, ir, rx, ry,
 * rz, rxp, trxp, rxr, tr, rxpv, trxpv, pvu, seps, sepp); not software provided by or
 * endorsed by SOFA. Differences: functions return new immutable values instead of
 * writing through pointers, and rotations return a rotated copy. Expression order
 * follows the C source. See SOFA_DERIVED_NOTICE.md.
 */
import { D2PI, DPI, dsign } from './constants.js';

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];
/** Position-velocity pair, SOFA `pv[2][3]`. */
export type PosVel = readonly [Vec3, Vec3];

export const ZERO_VECTOR: Vec3 = [0.0, 0.0, 0.0];
/** SOFA `iauIr`. */
export const IDENTITY_MATRIX: Mat3 = [
  [1.0, 0.0, 0.0],
  [0.0, 1.0, 0.0],
  [0.0, 0.0, 1.0],
];

/** SOFA `iauAnp`: normalize angle into the range 0 <= a < 2pi. */
export function normalizeAnglePositive(a: number): number {
  let w = a % D2PI;
  if (w < 0) w += D2PI;
  return w;
}

/** SOFA `iauAnpm`: normalize angle into the range -pi <= a < +pi. */
export function normalizeAngleSigned(a: number): number {
  let w = a % D2PI;
  if (Math.abs(w) >= DPI) w -= dsign(D2PI, a);
  return w;
}

/** SOFA `iauS2c`: spherical to unit vector. */
export function sphericalToCartesian(theta: number, phi: number): Vec3 {
  const cp = Math.cos(phi);
  return [Math.cos(theta) * cp, Math.sin(theta) * cp, Math.sin(phi)];
}

/** SOFA `iauC2s`: vector to spherical (theta, phi). */
export function cartesianToSpherical(p: Vec3): { theta: number; phi: number } {
  const [x, y, z] = p;
  const d2 = x * x + y * y;
  return {
    theta: d2 === 0.0 ? 0.0 : Math.atan2(y, x),
    phi: z === 0.0 ? 0.0 : Math.atan2(z, Math.sqrt(d2)),
  };
}

/** SOFA `iauPm`: modulus. */
export function modulus(p: Vec3): number {
  return Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
}

/** SOFA `iauPn`: modulus and unit vector (zero vector if the modulus is zero). */
export function normalize(p: Vec3): { r: number; u: Vec3 } {
  const w = modulus(p);
  return { r: w, u: w === 0.0 ? ZERO_VECTOR : scale(1.0 / w, p) };
}

/** SOFA `iauPdp`: inner product. */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** SOFA `iauPxp`: outer (cross) product. */
export function cross(a: Vec3, b: Vec3): Vec3 {
  const [xa, ya, za] = a;
  const [xb, yb, zb] = b;
  return [ya * zb - za * yb, za * xb - xa * zb, xa * yb - ya * xb];
}

/** SOFA `iauSxp`: scalar times vector. */
export function scale(s: number, p: Vec3): Vec3 {
  return [s * p[0], s * p[1], s * p[2]];
}

/** SOFA `iauPpp`: vector sum. */
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** SOFA `iauPmp`: vector difference. */
export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** SOFA `iauPpsp`: a + s*b. */
export function addScaled(a: Vec3, s: number, b: Vec3): Vec3 {
  return add(a, scale(s, b));
}

/** SOFA `iauRx`: rotate an r-matrix about the x-axis. */
export function rotateX(phi: number, r: Mat3): Mat3 {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const [r0, r1, r2] = r;
  return [
    r0,
    [c * r1[0] + s * r2[0], c * r1[1] + s * r2[1], c * r1[2] + s * r2[2]],
    [-s * r1[0] + c * r2[0], -s * r1[1] + c * r2[1], -s * r1[2] + c * r2[2]],
  ];
}

/** SOFA `iauRy`: rotate an r-matrix about the y-axis. */
export function rotateY(theta: number, r: Mat3): Mat3 {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const [r0, r1, r2] = r;
  return [
    [c * r0[0] - s * r2[0], c * r0[1] - s * r2[1], c * r0[2] - s * r2[2]],
    r1,
    [s * r0[0] + c * r2[0], s * r0[1] + c * r2[1], s * r0[2] + c * r2[2]],
  ];
}

/** SOFA `iauRz`: rotate an r-matrix about the z-axis. */
export function rotateZ(psi: number, r: Mat3): Mat3 {
  const s = Math.sin(psi);
  const c = Math.cos(psi);
  const [r0, r1, r2] = r;
  return [
    [c * r0[0] + s * r1[0], c * r0[1] + s * r1[1], c * r0[2] + s * r1[2]],
    [-s * r0[0] + c * r1[0], -s * r0[1] + c * r1[1], -s * r0[2] + c * r1[2]],
    r2,
  ];
}

/** SOFA `iauRxp`: r-matrix times p-vector. */
export function matrixTimesVector(r: Mat3, p: Vec3): Vec3 {
  const row = (j: 0 | 1 | 2): number => {
    let w = 0.0;
    for (let i = 0; i < 3; i++) w += r[j][i as 0 | 1 | 2] * p[i as 0 | 1 | 2];
    return w;
  };
  return [row(0), row(1), row(2)];
}

/** SOFA `iauTr`: transpose. */
export function transpose(r: Mat3): Mat3 {
  return [
    [r[0][0], r[1][0], r[2][0]],
    [r[0][1], r[1][1], r[2][1]],
    [r[0][2], r[1][2], r[2][2]],
  ];
}

/** SOFA `iauTrxp`: transpose of r-matrix times p-vector. */
export function transposeTimesVector(r: Mat3, p: Vec3): Vec3 {
  return matrixTimesVector(transpose(r), p);
}

/** SOFA `iauRxr`: r-matrix product a * b. */
export function matrixProduct(a: Mat3, b: Mat3): Mat3 {
  const element = (i: 0 | 1 | 2, j: 0 | 1 | 2): number => {
    let w = 0.0;
    for (let k = 0; k < 3; k++) w += a[i][k as 0 | 1 | 2] * b[k as 0 | 1 | 2][j];
    return w;
  };
  return [
    [element(0, 0), element(0, 1), element(0, 2)],
    [element(1, 0), element(1, 1), element(1, 2)],
    [element(2, 0), element(2, 1), element(2, 2)],
  ];
}

/** SOFA `iauTrxpv`: transpose of r-matrix times pv-vector. */
export function transposeTimesPosVel(r: Mat3, pv: PosVel): PosVel {
  const tr = transpose(r);
  return [matrixTimesVector(tr, pv[0]), matrixTimesVector(tr, pv[1])];
}

/** SOFA `iauPvu`: update a pv-vector by dt (position += dt * velocity). */
export function updatePosVel(dt: number, pv: PosVel): PosVel {
  return [addScaled(pv[0], dt, pv[1]), pv[1]];
}

/** SOFA `iauS2pv`: spherical position/velocity to pv-vector. */
export function sphericalToPosVel(
  theta: number,
  phi: number,
  r: number,
  td: number,
  pd: number,
  rd: number,
): PosVel {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const rcp = r * cp;
  const x = rcp * ct;
  const y = rcp * st;
  const rpd = r * pd;
  const w = rpd * sp - cp * rd;
  return [
    [x, y, r * sp],
    [-y * td - w * ct, x * td - w * st, rpd * cp + sp * rd],
  ];
}

/** SOFA `iauPv2s`: pv-vector to spherical coordinates and rates. */
export function posVelToSpherical(pv: PosVel): {
  theta: number;
  phi: number;
  r: number;
  td: number;
  pd: number;
  rd: number;
} {
  let [x, y, z] = pv[0];
  const [xd, yd, zd] = pv[1];
  let rxy2 = x * x + y * y;
  let r2 = rxy2 + z * z;
  const rtrue = Math.sqrt(r2);
  let rw = rtrue;
  if (rtrue === 0.0) {
    x = xd;
    y = yd;
    z = zd;
    rxy2 = x * x + y * y;
    r2 = rxy2 + z * z;
    rw = Math.sqrt(r2);
  }
  const rxy = Math.sqrt(rxy2);
  const xyp = x * xd + y * yd;
  let theta: number;
  let phi: number;
  let td: number;
  let pd: number;
  if (rxy2 !== 0.0) {
    theta = Math.atan2(y, x);
    phi = Math.atan2(z, rxy);
    td = (x * yd - y * xd) / rxy2;
    pd = (zd * rxy2 - z * xyp) / (r2 * rxy);
  } else {
    theta = 0.0;
    phi = z !== 0.0 ? Math.atan2(z, rxy) : 0.0;
    td = 0.0;
    pd = 0.0;
  }
  return { theta, phi, r: rtrue, td, pd, rd: rw !== 0.0 ? (xyp + z * zd) / rw : 0.0 };
}

/** SOFA `iauSepp`: angular separation between two p-vectors. */
export function separationOfVectors(a: Vec3, b: Vec3): number {
  const ss = modulus(cross(a, b));
  const cs = dot(a, b);
  return ss !== 0.0 || cs !== 0.0 ? Math.atan2(ss, cs) : 0.0;
}

/** SOFA `iauSeps`: angular separation between two sets of spherical coordinates. */
export function separationOfSpherical(al: number, ap: number, bl: number, bp: number): number {
  return separationOfVectors(sphericalToCartesian(al, ap), sphericalToCartesian(bl, bp));
}
