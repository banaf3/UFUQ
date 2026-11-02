/*
 * UFUQ derived work: uses routines and computations derived from IAU SOFA 2023-10-11
 * (fal03, falp03, faf03, fad03, faom03, fave03, fae03, fapa03, fame03, fama03, faju03,
 * fasa03, faur03, obl06, pfw06, fw2m, nut00a, nut06a, pnm06a, bpn2xy, s06, c2ixys); not
 * software provided by or endorsed by SOFA. Differences: TypeScript functions returning
 * values; the IAU 2000A series are read from flat generated tables in their original
 * order and summed from the last term to the first as in the C source. See
 * SOFA_DERIVED_NOTICE.md.
 */
import { D2PI, DAS2R, DJ00, DJC, TURNAS } from './constants.js';
import {
  LUNISOLAR_NUTATION_TERMS,
  PLANETARY_NUTATION_TERMS,
} from './tables/nutation-iau2000a-series.js';
import { IDENTITY_MATRIX, type Mat3, rotateX, rotateY, rotateZ } from './vector.js';

/** Julian centuries of TDB (TT acceptable) since J2000.0 from a two-part date. */
function centuriesSinceJ2000(date1: number, date2: number): number {
  return (date1 - DJ00 + date2) / DJC;
}

/** SOFA `iauFal03`: mean anomaly of the Moon (IERS 2003). */
export function meanAnomalyMoon(t: number): number {
  return (
    ((485868.249036 + t * (1717915923.2178 + t * (31.8792 + t * (0.051635 + t * -0.0002447)))) %
      TURNAS) *
    DAS2R
  );
}

/** SOFA `iauFalp03`: mean anomaly of the Sun (IERS 2003). */
export function meanAnomalySun(t: number): number {
  return (
    ((1287104.793048 + t * (129596581.0481 + t * (-0.5532 + t * (0.000136 + t * -0.00001149)))) %
      TURNAS) *
    DAS2R
  );
}

/** SOFA `iauFaf03`: mean longitude of the Moon minus that of the ascending node. */
export function meanArgumentOfLatitudeMoon(t: number): number {
  return (
    ((335779.526232 + t * (1739527262.8478 + t * (-12.7512 + t * (-0.001037 + t * 0.00000417)))) %
      TURNAS) *
    DAS2R
  );
}

/** SOFA `iauFad03`: mean elongation of the Moon from the Sun. */
export function meanElongationMoonSun(t: number): number {
  return (
    ((1072260.703692 + t * (1602961601.209 + t * (-6.3706 + t * (0.006593 + t * -0.00003169)))) %
      TURNAS) *
    DAS2R
  );
}

/** SOFA `iauFaom03`: mean longitude of the Moon's ascending node. */
export function meanLongitudeMoonNode(t: number): number {
  return (
    ((450160.398036 + t * (-6962890.5431 + t * (7.4722 + t * (0.007702 + t * -0.00005939)))) %
      TURNAS) *
    DAS2R
  );
}

/** SOFA `iauFave03`: mean longitude of Venus. */
export function meanLongitudeVenus(t: number): number {
  return (3.176146697 + 1021.3285546211 * t) % D2PI;
}

/** SOFA `iauFae03`: mean longitude of Earth. */
export function meanLongitudeEarth(t: number): number {
  return (1.753470314 + 628.3075849991 * t) % D2PI;
}

/** SOFA `iauFapa03`: general accumulated precession in longitude. */
export function generalPrecessionInLongitude(t: number): number {
  return (0.02438175 + 0.00000538691 * t) * t;
}

/** SOFA `iauFame03`: mean longitude of Mercury. */
export function meanLongitudeMercury(t: number): number {
  return (4.402608842 + 2608.7903141574 * t) % D2PI;
}

/** SOFA `iauFama03`: mean longitude of Mars. */
export function meanLongitudeMars(t: number): number {
  return (6.203480913 + 334.06124267 * t) % D2PI;
}

/** SOFA `iauFaju03`: mean longitude of Jupiter. */
export function meanLongitudeJupiter(t: number): number {
  return (0.599546497 + 52.9690962641 * t) % D2PI;
}

/** SOFA `iauFasa03`: mean longitude of Saturn. */
export function meanLongitudeSaturn(t: number): number {
  return (0.874016757 + 21.329910496 * t) % D2PI;
}

/** SOFA `iauFaur03`: mean longitude of Uranus. */
export function meanLongitudeUranus(t: number): number {
  return (5.481293872 + 7.4781598567 * t) % D2PI;
}

/** SOFA `iauObl06`: mean obliquity of the ecliptic, IAU 2006 precession model. */
export function meanObliquityIau2006(date1: number, date2: number): number {
  const t = centuriesSinceJ2000(date1, date2);
  return (
    (84381.406 +
      (-46.836769 + (-0.0001831 + (0.0020034 + (-0.000000576 + -0.0000000434 * t) * t) * t) * t) *
        t) *
    DAS2R
  );
}

export interface FukushimaWilliamsAngles {
  readonly gamb: number;
  readonly phib: number;
  readonly psib: number;
  readonly epsa: number;
}

/** SOFA `iauPfw06`: precession angles, IAU 2006 (Fukushima-Williams 4-angle formulation). */
export function precessionAnglesIau2006(date1: number, date2: number): FukushimaWilliamsAngles {
  const t = centuriesSinceJ2000(date1, date2);
  const gamb =
    (-0.052928 +
      (10.556378 + (0.4932044 + (-0.00031238 + (-0.000002788 + 0.000000026 * t) * t) * t) * t) *
        t) *
    DAS2R;
  const phib =
    (84381.412819 +
      (-46.811016 + (0.0511268 + (0.00053289 + (-0.00000044 + -0.0000000176 * t) * t) * t) * t) *
        t) *
    DAS2R;
  const psib =
    (-0.041775 +
      (5038.481484 + (1.5584175 + (-0.00018522 + (-0.000026452 + -0.0000000148 * t) * t) * t) * t) *
        t) *
    DAS2R;
  return { gamb, phib, psib, epsa: meanObliquityIau2006(date1, date2) };
}

/** SOFA `iauFw2m`: form a rotation matrix from Fukushima-Williams angles. */
export function fukushimaWilliamsToMatrix(
  gamb: number,
  phib: number,
  psi: number,
  eps: number,
): Mat3 {
  let r = IDENTITY_MATRIX;
  r = rotateZ(gamb, r);
  r = rotateX(phib, r);
  r = rotateZ(-psi, r);
  r = rotateX(-eps, r);
  return r;
}

export interface NutationAngles {
  readonly dpsi: number;
  readonly deps: number;
}

/** SOFA `iauNut00a`: nutation, IAU 2000A model (MHB2000 luni-solar and planetary). */
export function nutationIau2000A(date1: number, date2: number): NutationAngles {
  const U2R = DAS2R / 1e7;
  const t = centuriesSinceJ2000(date1, date2);

  const el = meanAnomalyMoon(t);
  const elp =
    ((1287104.79305 + t * (129596581.0481 + t * (-0.5532 + t * (0.000136 + t * -0.00001149)))) %
      TURNAS) *
    DAS2R;
  const f = meanArgumentOfLatitudeMoon(t);
  const d =
    ((1072260.70369 + t * (1602961601.209 + t * (-6.3706 + t * (0.006593 + t * -0.00003169)))) %
      TURNAS) *
    DAS2R;
  const om = meanLongitudeMoonNode(t);

  const ls = LUNISOLAR_NUTATION_TERMS;
  const lunisolarCount = ls.length / 11;
  let dp = 0.0;
  let de = 0.0;
  for (let i = lunisolarCount - 1; i >= 0; i--) {
    const o = i * 11;
    const arg =
      (term(ls, o) * el +
        term(ls, o + 1) * elp +
        term(ls, o + 2) * f +
        term(ls, o + 3) * d +
        term(ls, o + 4) * om) %
      D2PI;
    const sarg = Math.sin(arg);
    const carg = Math.cos(arg);
    dp += (term(ls, o + 5) + term(ls, o + 6) * t) * sarg + term(ls, o + 7) * carg;
    de += (term(ls, o + 8) + term(ls, o + 9) * t) * carg + term(ls, o + 10) * sarg;
  }
  const dpsils = dp * U2R;
  const depsls = de * U2R;

  const al = (2.35555598 + 8328.6914269554 * t) % D2PI;
  const af = (1.627905234 + 8433.466158131 * t) % D2PI;
  const ad = (5.198466741 + 7771.3771468121 * t) % D2PI;
  const aom = (2.1824392 - 33.757045 * t) % D2PI;
  const apa = generalPrecessionInLongitude(t);
  const alme = meanLongitudeMercury(t);
  const alve = meanLongitudeVenus(t);
  const alea = meanLongitudeEarth(t);
  const alma = meanLongitudeMars(t);
  const alju = meanLongitudeJupiter(t);
  const alsa = meanLongitudeSaturn(t);
  const alur = meanLongitudeUranus(t);
  const alne = (5.321159 + 3.8127774 * t) % D2PI;

  const pl = PLANETARY_NUTATION_TERMS;
  const planetaryCount = pl.length / 17;
  dp = 0.0;
  de = 0.0;
  for (let i = planetaryCount - 1; i >= 0; i--) {
    const o = i * 17;
    const arg =
      (term(pl, o) * al +
        term(pl, o + 1) * af +
        term(pl, o + 2) * ad +
        term(pl, o + 3) * aom +
        term(pl, o + 4) * alme +
        term(pl, o + 5) * alve +
        term(pl, o + 6) * alea +
        term(pl, o + 7) * alma +
        term(pl, o + 8) * alju +
        term(pl, o + 9) * alsa +
        term(pl, o + 10) * alur +
        term(pl, o + 11) * alne +
        term(pl, o + 12) * apa) %
      D2PI;
    const sarg = Math.sin(arg);
    const carg = Math.cos(arg);
    dp += term(pl, o + 13) * sarg + term(pl, o + 14) * carg;
    de += term(pl, o + 15) * sarg + term(pl, o + 16) * carg;
  }
  const dpsipl = dp * U2R;
  const depspl = de * U2R;
  return { dpsi: dpsils + dpsipl, deps: depsls + depspl };
}

/** SOFA `iauNut06a`: IAU 2000A nutation with adjustments to match IAU 2006 precession. */
export function nutationIau2006A(date1: number, date2: number): NutationAngles {
  const t = centuriesSinceJ2000(date1, date2);
  const fj2 = -2.7774e-6 * t;
  const { dpsi: dp, deps: de } = nutationIau2000A(date1, date2);
  return { dpsi: dp + dp * (0.4697e-6 + fj2), deps: de + de * fj2 };
}

/** SOFA `iauPnm06a`: bias-precession-nutation matrix, IAU 2006/2000A. */
export function biasPrecessionNutationMatrix(date1: number, date2: number): Mat3 {
  const { gamb, phib, psib, epsa } = precessionAnglesIau2006(date1, date2);
  const { dpsi: dp, deps: de } = nutationIau2006A(date1, date2);
  return fukushimaWilliamsToMatrix(gamb, phib, psib + dp, epsa + de);
}

/** SOFA `iauBpn2xy`: CIP X,Y coordinates from a bias-precession-nutation matrix. */
export function cipCoordinatesFromMatrix(rbpn: Mat3): { x: number; y: number } {
  return { x: rbpn[2][0], y: rbpn[2][1] };
}

type CioTerm = readonly [readonly number[], number, number];

const CIO_POLYNOMIAL = [94.0e-6, 3808.65e-6, -122.68e-6, -72574.11e-6, 27.98e-6, 15.62e-6] as const;

const CIO_S0: readonly CioTerm[] = [
  [[0, 0, 0, 0, 1, 0, 0, 0], -2640.73e-6, 0.39e-6],
  [[0, 0, 0, 0, 2, 0, 0, 0], -63.53e-6, 0.02e-6],
  [[0, 0, 2, -2, 3, 0, 0, 0], -11.75e-6, -0.01e-6],
  [[0, 0, 2, -2, 1, 0, 0, 0], -11.21e-6, -0.01e-6],
  [[0, 0, 2, -2, 2, 0, 0, 0], 4.57e-6, 0.0e-6],
  [[0, 0, 2, 0, 3, 0, 0, 0], -2.02e-6, 0.0e-6],
  [[0, 0, 2, 0, 1, 0, 0, 0], -1.98e-6, 0.0e-6],
  [[0, 0, 0, 0, 3, 0, 0, 0], 1.72e-6, 0.0e-6],
  [[0, 1, 0, 0, 1, 0, 0, 0], 1.41e-6, 0.01e-6],
  [[0, 1, 0, 0, -1, 0, 0, 0], 1.26e-6, 0.01e-6],
  [[1, 0, 0, 0, -1, 0, 0, 0], 0.63e-6, 0.0e-6],
  [[1, 0, 0, 0, 1, 0, 0, 0], 0.63e-6, 0.0e-6],
  [[0, 1, 2, -2, 3, 0, 0, 0], -0.46e-6, 0.0e-6],
  [[0, 1, 2, -2, 1, 0, 0, 0], -0.45e-6, 0.0e-6],
  [[0, 0, 4, -4, 4, 0, 0, 0], -0.36e-6, 0.0e-6],
  [[0, 0, 1, -1, 1, -8, 12, 0], 0.24e-6, 0.12e-6],
  [[0, 0, 2, 0, 0, 0, 0, 0], -0.32e-6, 0.0e-6],
  [[0, 0, 2, 0, 2, 0, 0, 0], -0.28e-6, 0.0e-6],
  [[1, 0, 2, 0, 3, 0, 0, 0], -0.27e-6, 0.0e-6],
  [[1, 0, 2, 0, 1, 0, 0, 0], -0.26e-6, 0.0e-6],
  [[0, 0, 2, -2, 0, 0, 0, 0], 0.21e-6, 0.0e-6],
  [[0, 1, -2, 2, -3, 0, 0, 0], -0.19e-6, 0.0e-6],
  [[0, 1, -2, 2, -1, 0, 0, 0], -0.18e-6, 0.0e-6],
  [[0, 0, 0, 0, 0, 8, -13, -1], 0.1e-6, -0.05e-6],
  [[0, 0, 0, 2, 0, 0, 0, 0], -0.15e-6, 0.0e-6],
  [[2, 0, -2, 0, -1, 0, 0, 0], 0.14e-6, 0.0e-6],
  [[0, 1, 2, -2, 2, 0, 0, 0], 0.14e-6, 0.0e-6],
  [[1, 0, 0, -2, 1, 0, 0, 0], -0.14e-6, 0.0e-6],
  [[1, 0, 0, -2, -1, 0, 0, 0], -0.14e-6, 0.0e-6],
  [[0, 0, 4, -2, 4, 0, 0, 0], -0.13e-6, 0.0e-6],
  [[0, 0, 2, -2, 4, 0, 0, 0], 0.11e-6, 0.0e-6],
  [[1, 0, -2, 0, -3, 0, 0, 0], -0.11e-6, 0.0e-6],
  [[1, 0, -2, 0, -1, 0, 0, 0], -0.11e-6, 0.0e-6],
];
const CIO_S1: readonly CioTerm[] = [
  [[0, 0, 0, 0, 2, 0, 0, 0], -0.07e-6, 3.57e-6],
  [[0, 0, 0, 0, 1, 0, 0, 0], 1.73e-6, -0.03e-6],
  [[0, 0, 2, -2, 3, 0, 0, 0], 0.0e-6, 0.48e-6],
];
const CIO_S2: readonly CioTerm[] = [
  [[0, 0, 0, 0, 1, 0, 0, 0], 743.52e-6, -0.17e-6],
  [[0, 0, 2, -2, 2, 0, 0, 0], 56.91e-6, 0.06e-6],
  [[0, 0, 2, 0, 2, 0, 0, 0], 9.84e-6, -0.01e-6],
  [[0, 0, 0, 0, 2, 0, 0, 0], -8.85e-6, 0.01e-6],
  [[0, 1, 0, 0, 0, 0, 0, 0], -6.38e-6, -0.05e-6],
  [[1, 0, 0, 0, 0, 0, 0, 0], -3.07e-6, 0.0e-6],
  [[0, 1, 2, -2, 2, 0, 0, 0], 2.23e-6, 0.0e-6],
  [[0, 0, 2, 0, 1, 0, 0, 0], 1.67e-6, 0.0e-6],
  [[1, 0, 2, 0, 2, 0, 0, 0], 1.3e-6, 0.0e-6],
  [[0, 1, -2, 2, -2, 0, 0, 0], 0.93e-6, 0.0e-6],
  [[1, 0, 0, -2, 0, 0, 0, 0], 0.68e-6, 0.0e-6],
  [[0, 0, 2, -2, 1, 0, 0, 0], -0.55e-6, 0.0e-6],
  [[1, 0, -2, 0, -2, 0, 0, 0], 0.53e-6, 0.0e-6],
  [[0, 0, 0, 2, 0, 0, 0, 0], -0.27e-6, 0.0e-6],
  [[1, 0, 0, 0, 1, 0, 0, 0], -0.27e-6, 0.0e-6],
  [[1, 0, -2, -2, -2, 0, 0, 0], -0.26e-6, 0.0e-6],
  [[1, 0, 0, 0, -1, 0, 0, 0], -0.25e-6, 0.0e-6],
  [[1, 0, 2, 0, 1, 0, 0, 0], 0.22e-6, 0.0e-6],
  [[2, 0, 0, -2, 0, 0, 0, 0], -0.21e-6, 0.0e-6],
  [[2, 0, -2, 0, -1, 0, 0, 0], 0.2e-6, 0.0e-6],
  [[0, 0, 2, 2, 2, 0, 0, 0], 0.17e-6, 0.0e-6],
  [[2, 0, 2, 0, 2, 0, 0, 0], 0.13e-6, 0.0e-6],
  [[2, 0, 0, 0, 0, 0, 0, 0], -0.13e-6, 0.0e-6],
  [[1, 0, 2, -2, 2, 0, 0, 0], -0.12e-6, 0.0e-6],
  [[0, 0, 2, 0, 0, 0, 0, 0], -0.11e-6, 0.0e-6],
];
const CIO_S3: readonly CioTerm[] = [
  [[0, 0, 0, 0, 1, 0, 0, 0], 0.3e-6, -23.42e-6],
  [[0, 0, 2, -2, 2, 0, 0, 0], -0.03e-6, -1.46e-6],
  [[0, 0, 2, 0, 2, 0, 0, 0], -0.01e-6, -0.25e-6],
  [[0, 0, 0, 0, 2, 0, 0, 0], 0.0e-6, 0.23e-6],
];
const CIO_S4: readonly CioTerm[] = [[[0, 0, 0, 0, 1, 0, 0, 0], -0.26e-6, -0.01e-6]];

function sumCioSeries(series: readonly CioTerm[], fa: readonly number[], start: number): number {
  let w = start;
  for (let i = series.length - 1; i >= 0; i--) {
    const [nfa, s, c] = series[i] as CioTerm;
    let a = 0.0;
    for (let j = 0; j < 8; j++) a += (nfa[j] as number) * (fa[j] as number);
    w += s * Math.sin(a) + c * Math.cos(a);
  }
  return w;
}

/** SOFA `iauS06`: CIO locator s, given CIP X,Y, IAU 2006/2000A compatible. */
export function cioLocatorIau2006(date1: number, date2: number, x: number, y: number): number {
  const t = centuriesSinceJ2000(date1, date2);
  const fa = [
    meanAnomalyMoon(t),
    meanAnomalySun(t),
    meanArgumentOfLatitudeMoon(t),
    meanElongationMoonSun(t),
    meanLongitudeMoonNode(t),
    meanLongitudeVenus(t),
    meanLongitudeEarth(t),
    generalPrecessionInLongitude(t),
  ];
  const sp = CIO_POLYNOMIAL;
  const w0 = sumCioSeries(CIO_S0, fa, sp[0]);
  const w1 = sumCioSeries(CIO_S1, fa, sp[1]);
  const w2 = sumCioSeries(CIO_S2, fa, sp[2]);
  const w3 = sumCioSeries(CIO_S3, fa, sp[3]);
  const w4 = sumCioSeries(CIO_S4, fa, sp[4]);
  const w5 = sp[5];
  return (w0 + (w1 + (w2 + (w3 + (w4 + w5 * t) * t) * t) * t) * t) * DAS2R - (x * y) / 2.0;
}

/** SOFA `iauC2ixys`: celestial-to-intermediate matrix from CIP X,Y and CIO locator s. */
export function celestialToIntermediateMatrix(x: number, y: number, s: number): Mat3 {
  const r2 = x * x + y * y;
  const e = r2 > 0.0 ? Math.atan2(y, x) : 0.0;
  const d = Math.atan(Math.sqrt(r2 / (1.0 - r2)));
  let r = IDENTITY_MATRIX;
  r = rotateZ(e, r);
  r = rotateY(d, r);
  r = rotateZ(-(e + s), r);
  return r;
}

function term(table: readonly number[], index: number): number {
  return table[index] as number;
}
