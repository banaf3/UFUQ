/*
 * UFUQ DERIVED WORK of IERS Conventions (2010) software (ORTHO_EOP, CNMTX, PMSDNUT2,
 * UTLIBR, FUNDARG; official package iersconventions_v1_0_0). This is NOT IERS
 * Conventions software and is neither distributed by nor endorsed by the IERS
 * Conventions Center. Routines are renamed and translated from Fortran 77 to
 * TypeScript; Fortran default-REAL literals are reproduced with Math.fround. See
 * IERS_CONVENTIONS_DERIVED_NOTICE.md for the full description of differences and the
 * reproduced IERS Conventions Software License.
 */

const TWOPI = 6.283185307179586476925287;
const PI = 3.141592653589793238462643;
const DAS2R = 4.848136811095359935899141e-6;
const TURNAS = 1296000;
const RMJD0 = 51544.5;
const RAD2SEC = 86400 / TWOPI;
/** Fortran default-REAL constant converted to double precision. */
const real = Math.fround;

export interface FundamentalArguments {
  /** Mean anomaly of the Moon (rad). */
  readonly l: number;
  /** Mean anomaly of the Sun (rad). */
  readonly lp: number;
  /** L - OM (rad). */
  readonly f: number;
  /** Mean elongation of the Moon from the Sun (rad). */
  readonly d: number;
  /** Mean longitude of the Moon's ascending node (rad). */
  readonly om: number;
}

/** Derived from FUNDARG: Delaunay arguments; `t` in TT Julian centuries since J2000. */
export function fundamentalArgumentsIers2010(t: number): FundamentalArguments {
  const l =
    ((485868.249036 + t * (1717915923.2178 + t * (31.8792 + t * (0.051635 + t * -0.0002447)))) %
      TURNAS) *
    DAS2R;
  const lp =
    ((1287104.79305 + t * (129596581.0481 + t * (-0.5532 + t * (0.000136 + t * -0.00001149)))) %
      TURNAS) *
    DAS2R;
  const f =
    ((335779.526232 + t * (1739527262.8478 + t * (-12.7512 + t * (-0.001037 + t * 0.00000417)))) %
      TURNAS) *
    DAS2R;
  const d =
    ((1072260.70369 + t * (1602961601.209 + t * (-6.3706 + t * (0.006593 + t * -0.00003169)))) %
      TURNAS) *
    DAS2R;
  const om =
    ((450160.398036 + t * (-6962890.5431 + t * (7.4722 + t * (0.007702 + t * -0.00005939)))) %
      TURNAS) *
    DAS2R;
  return { l, lp, f, d, om };
}

// CNMTX tidal potential model for 71 diurnal and semidiurnal lines:
// n, m, HS, PHASE, FREQ (all written with D0 in the original, so exact doubles).
const TIDAL_LINES: readonly (readonly [number, number, number, number, number])[] = [
  [2, 1, -1.94, 9.0899831, 5.1868805],
  [2, 1, -1.25, 8.8234208, 5.38346657],
  [2, 1, -6.64, 12.1189598, 5.38439079],
  [2, 1, -1.51, 1.44257, 5.41398343],
  [2, 1, -8.02, 4.738109, 5.41490765],
  [2, 1, -9.47, 4.4715466, 5.61149372],
  [2, 1, -50.2, 7.7670857, 5.61241794],
  [2, 1, -1.8, -2.9093042, 5.64201057],
  [2, 1, -9.54, 0.3862349, 5.64293479],
  [2, 1, 1.52, -3.1758666, 5.83859664],
  [2, 1, -49.45, 0.1196725, 5.83952086],
  [2, 1, -262.21, 3.4152116, 5.84044508],
  [2, 1, 1.7, 12.8946194, 5.84433381],
  [2, 1, 3.43, 5.5137686, 5.87485066],
  [2, 1, 1.94, 6.4441883, 6.03795537],
  [2, 1, 1.37, -4.2322016, 6.06754801],
  [2, 1, 7.41, -0.9366625, 6.06847223],
  [2, 1, 20.62, 8.5427453, 6.07236095],
  [2, 1, 4.14, 11.8382843, 6.07328517],
  [2, 1, 3.94, 1.1618945, 6.10287781],
  [2, 1, -7.14, 5.9693878, 6.24878055],
  [2, 1, 1.37, -1.2032249, 6.2650583],
  [2, 1, -122.03, 2.0923141, 6.26598252],
  [2, 1, 1.02, -1.7847596, 6.28318449],
  [2, 1, 2.89, 8.0679449, 6.28318613],
  [2, 1, -7.3, 0.8953321, 6.29946388],
  [2, 1, 368.78, 4.1908712, 6.3003881],
  [2, 1, 50.01, 7.4864102, 6.30131232],
  [2, 1, -1.08, 10.7819493, 6.30223654],
  [2, 1, 2.93, 0.3137975, 6.31759007],
  [2, 1, 5.25, 6.2894282, 6.33479368],
  [2, 1, 3.95, 7.2198478, 6.49789839],
  [2, 1, 20.62, -0.161003, 6.52841524],
  [2, 1, 4.09, 3.1345361, 6.52933946],
  [2, 1, 3.42, 2.8679737, 6.72592553],
  [2, 1, 1.69, -4.5128771, 6.75644239],
  [2, 1, 11.29, 4.9665307, 6.76033111],
  [2, 1, 7.23, 8.2620698, 6.76125533],
  [2, 1, 1.51, 11.5576089, 6.76217955],
  [2, 1, 2.16, 0.6146566, 6.98835826],
  [2, 1, 1.38, 3.9101957, 6.98928248],
  [2, 2, 1.8, 20.6617051, 11.45675174],
  [2, 2, 4.67, 13.2808543, 11.4872686],
  [2, 2, 16.01, 16.309831, 11.68477889],
  [2, 2, 19.32, 8.9289802, 11.71529575],
  [2, 2, 1.3, 5.0519065, 11.73249771],
  [2, 2, -1.02, 15.8350306, 11.89560406],
  [2, 2, -4.51, 8.6624178, 11.91188181],
  [2, 2, 120.99, 11.9579569, 11.91280603],
  [2, 2, 1.13, 8.0808832, 11.930008],
  [2, 2, 22.98, 4.5771061, 11.94332289],
  [2, 2, 1.06, 0.7000324, 11.96052486],
  [2, 2, -1.9, 14.9869335, 12.11031632],
  [2, 2, -2.18, 11.4831564, 12.12363121],
  [2, 2, -23.58, 4.3105437, 12.13990896],
  [2, 2, 631.92, 7.6060827, 12.14083318],
  [2, 2, 1.92, 3.729009, 12.15803515],
  [2, 2, -4.66, 10.6350594, 12.33834347],
  [2, 2, -17.86, 3.2542086, 12.36886033],
  [2, 2, 4.47, 12.7336164, 12.37274905],
  [2, 2, 1.97, 16.0291555, 12.37367327],
  [2, 2, 17.2, 10.160259, 12.54916865],
  [2, 2, 294.0, 6.2831853, 12.56637061],
  [2, 2, -2.46, 2.4061116, 12.58357258],
  [2, 2, -1.02, 5.0862033, 12.59985198],
  [2, 2, 79.96, 8.3817423, 12.6007762],
  [2, 2, 23.83, 11.6772814, 12.60170041],
  [2, 2, 2.59, 14.9728205, 12.60262463],
  [2, 2, 4.47, 4.0298682, 12.82880334],
  [2, 2, 1.95, 7.3254073, 12.82972756],
  [2, 2, 1.17, 9.1574019, 13.06071921],
];

/** CNMTX orthotide weight factors SP(1..6, M=1..2). */
const ORTHOTIDE_WEIGHTS: readonly (readonly number[])[] = [
  [0.0298, 0.1408, 0.0805, 0.6002, 0.3025, 0.1517],
  [0.02, 0.0905, 0.0638, 0.3476, 0.1645, 0.0923],
];

/**
 * Derived from CNMTX: time-dependent part of the second-degree diurnal and semidiurnal
 * tidal potential (12 partials with respect to the orthoweights). `dmjd` is an MJD.
 */
export function tidalPotentialPartials(dmjd: number): readonly number[] {
  const DT = 2;
  const D1960 = 37076.5;
  // anm[m-1][k+1], bnm[m-1][k+1] for n = 2, m = 1..2, k = -1..1
  const anm = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bnm = [
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let k = -1; k <= 1; k++) {
    const dt60 = dmjd - k * DT - D1960;
    for (const [n, m, hs, phase, freq] of TIDAL_LINES) {
      const pinm = (((n + m) % 2) * TWOPI) / 4.0;
      const alpha = ((phase - pinm) % TWOPI) + ((freq * dt60) % TWOPI);
      const am = anm[m - 1] as number[];
      const bm = bnm[m - 1] as number[];
      am[k + 1] = (am[k + 1] as number) + hs * Math.cos(alpha);
      bm[k + 1] = (bm[k + 1] as number) - hs * Math.sin(alpha);
    }
  }
  for (let m = 1; m <= 2; m++) {
    const a = anm[m - 1] as [number, number, number];
    const b = bnm[m - 1] as [number, number, number];
    const sp = ORTHOTIDE_WEIGHTS[m - 1] as readonly number[];
    const s = (i: number) => sp[i - 1] as number;
    const ap = a[2] + a[0];
    const am = a[2] - a[0];
    const bp = b[2] + b[0];
    const bm = b[2] - b[0];
    const p0 = s(1) * a[1];
    const p1 = s(2) * a[1] - s(3) * ap;
    const p2 = s(4) * a[1] - s(5) * ap + s(6) * bm;
    const q0 = s(1) * b[1];
    const q1 = s(2) * b[1] - s(3) * bp;
    const q2 = s(4) * b[1] - s(5) * bp - s(6) * am;
    anm[m - 1] = [p0, p1, p2];
    bnm[m - 1] = [q0, q1, q2];
  }
  const h: number[] = [];
  for (let m = 1; m <= 2; m++) {
    for (let k = -1; k <= 1; k++) {
      h.push((anm[m - 1] as number[])[k + 1] as number, (bnm[m - 1] as number[])[k + 1] as number);
    }
  }
  return h;
}

/** ORTHO_EOP orthoweights ORTHOW(12, 3): columns x, y, UT1. */
const ORTHOWEIGHTS: readonly (readonly number[])[] = [
  [
    -6.77832, -14.86323, 0.47884, -1.45303, 0.16406, 0.4203, 0.09398, 25.73054, -4.77974, 0.2808,
    1.94539, -0.73089,
  ],
  [
    14.86283, -6.77846, 1.45234, 0.47888, -0.42056, 0.16469, 15.30276, -4.30615, 0.07564, 2.28321,
    -0.45717, -1.6201,
  ],
  [
    -1.76335, 1.03364, -0.27553, 0.34569, -0.12343, -0.10146, -0.47119, 1.28997, -0.19336, 0.02724,
    0.08955, 0.04726,
  ],
];

export interface SubdailyPolarMotionUt1 {
  /** Delta x (microarcseconds). */
  readonly xMicroarcseconds: number;
  /** Delta y (microarcseconds). */
  readonly yMicroarcseconds: number;
  /** Delta UT1 (microseconds). */
  readonly ut1Microseconds: number;
}

/** Derived from ORTHO_EOP: diurnal/semidiurnal ocean-tide variations in x, y, UT1. */
export function oceanTideEopVariations(time: number): SubdailyPolarMotionUt1 {
  const h = tidalPotentialPartials(time);
  const eop = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    let sum = 0;
    const weights = ORTHOWEIGHTS[k] as readonly number[];
    for (let j = 0; j < 12; j++) sum = sum + (h[j] as number) * (weights[j] as number);
    eop[k] = sum;
  }
  return {
    xMicroarcseconds: eop[0] as number,
    yMicroarcseconds: eop[1] as number,
    ut1Microseconds: eop[2] as number,
  };
}

/** GMST + pi as computed inside PMSDNUT2 and UTLIBR (time argument as supplied). */
function gmstPlusPi(t: number): number {
  const gmst =
    (67310.54841 + t * (8640184.812866 + 3155760000 + t * (0.093104 + t * real(-0.0000062)))) %
    86400;
  return (gmst / RAD2SEC + PI) % TWOPI;
}

// PMSDNUT2 quasi-diurnal terms (J = 16..25): IARG(1..6), XS, XC, YS, YC (default REAL).
const PM_DIURNAL_TERMS: readonly (readonly number[])[] = [
  [1, -1, 0, -2, 0, -1, -0.4, 0.3, -0.3, -0.4],
  [1, -1, 0, -2, 0, -2, -2.3, 1.3, -1.3, -2.3],
  [1, 1, 0, -2, -2, -2, -0.4, 0.3, -0.3, -0.4],
  [1, 0, 0, -2, 0, -1, -2.1, 1.2, -1.2, -2.1],
  [1, 0, 0, -2, 0, -2, -11.4, 6.5, -6.5, -11.4],
  [1, -1, 0, 0, 0, 0, 0.8, -0.5, 0.5, 0.8],
  [1, 0, 0, -2, 2, -2, -4.8, 2.7, -2.7, -4.8],
  [1, 0, 0, 0, 0, 0, 14.3, -8.2, 8.2, 14.3],
  [1, 0, 0, 0, 0, -1, 1.9, -1.1, 1.1, 1.9],
  [1, 1, 0, 0, 0, 0, 0.8, -0.4, 0.4, 0.8],
];

function argumentVector(rmjd: number): readonly number[] {
  const t = (rmjd - RMJD0) / 36525;
  const { l, lp, f, d, om } = fundamentalArgumentsIers2010(t);
  return [gmstPlusPi(t), l, lp, f, d, om];
}

/**
 * Derived from PMSDNUT2 with IBAND = 1: subdiurnal libration in polar motion
 * (quasi-diurnal terms of IERS Conventions 2010 Table 5.1a), in microarcseconds.
 */
export function librationPolarMotionDiurnal(rmjd: number): {
  readonly xMicroarcseconds: number;
  readonly yMicroarcseconds: number;
} {
  const arg = argumentVector(rmjd);
  let x = 0;
  let y = 0;
  for (const row of PM_DIURNAL_TERMS) {
    let angle = 0;
    for (let i = 0; i < 6; i++) angle = angle + (row[i] as number) * (arg[i] as number);
    angle = angle % TWOPI;
    x = x + real(row[6] as number) * Math.sin(angle) + real(row[7] as number) * Math.cos(angle);
    y = y + real(row[8] as number) * Math.sin(angle) + real(row[9] as number) * Math.cos(angle);
  }
  return { xMicroarcseconds: x, yMicroarcseconds: y };
}

// UTLIBR semidiurnal terms: IARG(1..6), DUT1S, DUT1C, DLODS, DLODC (default REAL).
const UT1_SEMIDIURNAL_TERMS: readonly (readonly number[])[] = [
  [2, -2, 0, -2, 0, -2, 0.05, -0.03, -0.3, -0.6],
  [2, 0, 0, -2, -2, -2, 0.06, -0.03, -0.4, -0.7],
  [2, -1, 0, -2, 0, -2, 0.35, -0.2, -2.4, -4.1],
  [2, 1, 0, -2, -2, -2, 0.07, -0.04, -0.5, -0.8],
  [2, 0, 0, -2, 0, -1, -0.07, 0.04, 0.5, 0.8],
  [2, 0, 0, -2, 0, -2, 1.75, -1.01, -12.2, -21.3],
  [2, 1, 0, -2, 0, -2, -0.05, 0.03, 0.3, 0.6],
  [2, 0, -1, -2, 2, -2, 0.04, -0.03, -0.3, -0.6],
  [2, 0, 0, -2, 2, -2, 0.76, -0.44, -5.5, -9.6],
  [2, 0, 0, 0, 0, 0, 0.21, -0.12, -1.5, -2.6],
  [2, 0, 0, 0, 0, -1, 0.06, -0.04, -0.4, -0.8],
];

/** Derived from UTLIBR: semidiurnal libration in UT1 (us) and LOD (us/day). */
export function librationUt1Semidiurnal(rmjd: number): {
  readonly ut1Microseconds: number;
  readonly lodMicrosecondsPerDay: number;
} {
  const arg = argumentVector(rmjd);
  let dut1 = 0;
  let dlod = 0;
  for (const row of UT1_SEMIDIURNAL_TERMS) {
    let angle = 0;
    for (let i = 0; i < 6; i++) angle = angle + (row[i] as number) * (arg[i] as number);
    angle = angle % TWOPI;
    dut1 =
      dut1 + real(row[6] as number) * Math.sin(angle) + real(row[7] as number) * Math.cos(angle);
    dlod =
      dlod + real(row[8] as number) * Math.sin(angle) + real(row[9] as number) * Math.cos(angle);
  }
  return { ut1Microseconds: dut1, lodMicrosecondsPerDay: dlod };
}
