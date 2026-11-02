/**
 * Fail-closed parser for the ESA Hipparcos 1997 `hipparcos1.hip_main` CSV TAP response
 * (Milestone 2D.1D source). Every one of the 76 native columns is preserved as source
 * text; normalized values are derived separately and never replace native fields.
 * Field semantics: ESA SP-1200 (H1-H77) and
 * docs/references/studies/hipparcos-esa-1997-field-semantics.study.md.
 */
import { parseCsv } from './csv.js';

export const HIP_MAIN_COLUMNS = [
  'HIP',
  'Proxy',
  'RAhms',
  'DEdms',
  'Vmag',
  'VarFlag',
  'r_Vmag',
  'RAdeg',
  'DEdeg',
  'AstroRef',
  'Plx',
  'pmRA',
  'pmDE',
  'e_RAdeg',
  'e_DEdeg',
  'e_Plx',
  'e_pmRA',
  'e_pmDE',
  'DE:RA',
  'Plx:RA',
  'Plx:DE',
  'pmRA:RA',
  'pmRA:DE',
  'pmRA:Plx',
  'pmDE:RA',
  'pmDE:DE',
  'pmDE:Plx',
  'pmDE:pmRA',
  'F1',
  'F2',
  'BTmag',
  'e_BTmag',
  'VTmag',
  'e_VTmag',
  'm_BTmag',
  'B-V',
  'e_B-V',
  'r_B-V',
  'V-I',
  'e_V-I',
  'r_V-I',
  'CombMag',
  'Hpmag',
  'e_Hpmag',
  'Hpscat',
  'o_Hpmag',
  'm_Hpmag',
  'Hpmax',
  'HPmin',
  'Period',
  'HvarType',
  'moreVar',
  'morePhoto',
  'CCDM',
  'n_CCDM',
  'Nsys',
  'Ncomp',
  'MultFlag',
  'Source',
  'Qual',
  'm_HIP',
  'theta',
  'rho',
  'e_rho',
  'dHp',
  'e_dHp',
  'Survey',
  'Chart',
  'Notes',
  'HD',
  'BD',
  'CoD',
  'CPD',
  '(V-I)red',
  'SpType',
  'r_SpType',
] as const;

export type HipMainColumn = (typeof HIP_MAIN_COLUMNS)[number];
export type HipMainNativeRow = Readonly<Record<HipMainColumn, string>>;

export function parseHipMainCsv(text: string): HipMainNativeRow[] {
  const records = parseCsv(text);
  const header = records[0];
  if (header === undefined) throw new SyntaxError('Empty hip_main response.');
  if (
    header.length !== HIP_MAIN_COLUMNS.length ||
    header.some((name, i) => name !== HIP_MAIN_COLUMNS[i])
  ) {
    throw new SyntaxError('hip_main header differs from the pinned 76-column contract.');
  }
  const rows = records.slice(1).filter((record) => !(record.length === 1 && record[0] === ''));
  const seen = new Set<string>();
  return rows.map((record, index) => {
    if (record.length !== HIP_MAIN_COLUMNS.length) {
      throw new SyntaxError(`hip_main row ${index + 1} has ${record.length} fields, not 76.`);
    }
    const row = Object.fromEntries(HIP_MAIN_COLUMNS.map((name, i) => [name, record[i] as string]));
    const hip = row.HIP as string;
    if (!/^\d{1,6}$/.test(hip)) throw new SyntaxError(`Invalid HIP identifier ${hip}.`);
    if (seen.has(hip)) throw new SyntaxError(`Duplicate HIP ${hip}.`);
    seen.add(hip);
    return row as HipMainNativeRow;
  });
}

const DECIMAL = /^[+-]?\d+(?:\.\d+)?$/;

function required(row: HipMainNativeRow, column: HipMainColumn): number {
  const text = row[column].trim();
  if (!DECIMAL.test(text))
    throw new SyntaxError(`HIP ${row.HIP} ${column} is not a decimal: "${text}".`);
  return Number(text);
}

function optional(row: HipMainNativeRow, column: HipMainColumn): number | null {
  const text = row[column].trim();
  if (text === '') return null;
  if (!DECIMAL.test(text))
    throw new SyntaxError(`HIP ${row.HIP} ${column} is not a decimal: "${text}".`);
  return Number(text);
}

export interface NormalizedHipMainAstrometry {
  readonly hip: number;
  /** ICRS position at epoch J1991.25(TT) (H8, H9), degrees and radians. */
  readonly rightAscensionDegrees: number;
  readonly declinationDegrees: number;
  readonly rightAscensionRadians: number;
  readonly declinationRadians: number;
  /** H11, mas; H12 mu_alpha_star (already times cos dec) and H13, mas per Julian year. */
  readonly parallaxMas: number;
  readonly muAlphaStarMasPerYear: number;
  readonly muDeltaMasPerYear: number;
  /** Standard errors H14-H18 (mas, mas/yr); H14 is sigma of alpha_star. */
  readonly standardErrors: readonly [number, number, number, number, number];
  /** Correlations H19-H28 in the source order DE:RA, Plx:RA, Plx:DE, pmRA:RA, pmRA:DE, pmRA:Plx, pmDE:RA, pmDE:DE, pmDE:Plx, pmDE:pmRA. */
  readonly correlations: readonly number[];
  /** 5x5 covariance, order (alpha_star, delta, parallax, mu_alpha_star, mu_delta), mas^2, mas^2/yr, mas^2/yr^2. */
  readonly covariance: readonly (readonly number[])[];
  /** H5 Johnson V magnitude, used only for rendering size, never for visibility. */
  readonly visualMagnitude: number | null;
  readonly henryDraperNumber: number | null;
}

const DD2R = Math.PI / 180;

export function normalizeHipMainRow(row: HipMainNativeRow): NormalizedHipMainAstrometry {
  const raDeg = required(row, 'RAdeg');
  const decDeg = required(row, 'DEdeg');
  const errors = [
    required(row, 'e_RAdeg'),
    required(row, 'e_DEdeg'),
    required(row, 'e_Plx'),
    required(row, 'e_pmRA'),
    required(row, 'e_pmDE'),
  ] as const;
  const correlationColumns = [
    'DE:RA',
    'Plx:RA',
    'Plx:DE',
    'pmRA:RA',
    'pmRA:DE',
    'pmRA:Plx',
    'pmDE:RA',
    'pmDE:DE',
    'pmDE:Plx',
    'pmDE:pmRA',
  ] as const;
  const correlations = correlationColumns.map((column) => required(row, column));
  if (correlations.some((value) => Math.abs(value) > 1)) {
    throw new RangeError(`HIP ${row.HIP} has a correlation outside [-1, 1].`);
  }
  // Index pairs (i, j), i > j, for the source correlation order above.
  const pairs: readonly (readonly [number, number])[] = [
    [1, 0],
    [2, 0],
    [2, 1],
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
  ];
  const covariance = errors.map((si, i) => errors.map((sj, j) => (i === j ? si * sj : 0)));
  pairs.forEach(([i, j], k) => {
    const value = (correlations[k] as number) * (errors[i] as number) * (errors[j] as number);
    (covariance[i] as number[])[j] = value;
    (covariance[j] as number[])[i] = value;
  });
  const hd = row.HD.trim();
  return {
    hip: Number(row.HIP),
    rightAscensionDegrees: raDeg,
    declinationDegrees: decDeg,
    rightAscensionRadians: raDeg * DD2R,
    declinationRadians: decDeg * DD2R,
    parallaxMas: required(row, 'Plx'),
    muAlphaStarMasPerYear: required(row, 'pmRA'),
    muDeltaMasPerYear: required(row, 'pmDE'),
    standardErrors: errors,
    correlations,
    covariance,
    visualMagnitude: optional(row, 'Vmag'),
    henryDraperNumber: /^\d+$/.test(hd) ? Number(hd) : null,
  };
}

export interface GateCExpectation {
  readonly hip: number;
  readonly componentCount: number;
  readonly astroRef: string;
  readonly multFlag: string;
  readonly mHip: string;
}

/** 2D.1E gate C: the parser fails if a route row's identity/solution flags differ. */
export function verifyGateC(row: HipMainNativeRow, expected: GateCExpectation): void {
  const actual = {
    componentCount: Number(row.Ncomp.trim()),
    astroRef: row.AstroRef.trim(),
    multFlag: row.MultFlag.trim(),
    mHip: row.m_HIP.trim(),
  };
  for (const key of ['componentCount', 'astroRef', 'multFlag', 'mHip'] as const) {
    if (actual[key] !== expected[key]) {
      throw new Error(
        `HIP ${expected.hip} gate C ${key} is "${actual[key]}", expected "${expected[key]}".`,
      );
    }
  }
}

/** Amendment A1 per-row omission bound |mu| * (v_r / d) * t^2, in mas per km/s of RV. */
export function radialVelocityOmissionBound(
  astrometry: NormalizedHipMainAstrometry,
  sourceJulianEpoch: number,
  horizonJulianEpoch: number,
): number {
  const AU_KM = 149597870.7;
  const JULIAN_YEAR_S = 365.25 * 86400;
  const mu = Math.hypot(astrometry.muAlphaStarMasPerYear, astrometry.muDeltaMasPerYear);
  const distanceKm = (1000 / astrometry.parallaxMas) * (648000 / Math.PI) * AU_KM;
  const perYearPerKmS = JULIAN_YEAR_S / distanceKm;
  const t = horizonJulianEpoch - sourceJulianEpoch;
  return mu * perYearPerKmS * t * t;
}
