// Milestone 2E parser tests with synthetic inputs only (no raw or restricted bytes).
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../src/canonical-json.js';
import { parseCsv } from '../src/parsers/csv.js';
import {
  HIP_MAIN_COLUMNS,
  normalizeHipMainRow,
  parseHipMainCsv,
  radialVelocityOmissionBound,
  verifyGateC,
} from '../src/parsers/hipparcos-esa-1997.js';
import {
  bulletinCConsistency,
  parseBulletinBSection1,
  parseBulletinC,
  parseNtpLeapList,
} from '../src/parsers/iers.js';

function hipRow(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = Object.fromEntries(HIP_MAIN_COLUMNS.map((c) => [c, '']));
  Object.assign(values, {
    HIP: '746',
    RAdeg: '2.29204036',
    DEdeg: '59.15021814',
    Plx: '59.89',
    pmRA: '523.39',
    pmDE: '-180.42',
    e_RAdeg: '0.36',
    e_DEdeg: '0.42',
    e_Plx: '0.56',
    e_pmRA: '0.41',
    e_pmDE: '0.37',
    Vmag: '2.28',
    Ncomp: '1',
    HD: '432',
    ...Object.fromEntries(
      [
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
      ].map((c, i) => [c, (0.01 * (i + 1)).toFixed(2)]),
    ),
    ...overrides,
  });
  return HIP_MAIN_COLUMNS.map((c) => (values[c] === ' ' ? '" "' : (values[c] as string))).join(',');
}

const header = HIP_MAIN_COLUMNS.join(',');

describe('CSV reader', () => {
  it('handles quotes, doubled quotes and CRLF', () => {
    expect(parseCsv('a,"b,""c""",d\r\n1,2,3\n')).toEqual([
      ['a', 'b,"c"', 'd'],
      ['1', '2', '3'],
    ]);
    expect(() => parseCsv('"unterminated')).toThrow();
  });
});

describe('ESA Hipparcos 1997 hip_main parser', () => {
  it('preserves 76 native columns and builds a symmetric covariance', () => {
    const rows = parseHipMainCsv(`${header}\n${hipRow({ AstroRef: ' ' })}\n`);
    expect(Object.keys(rows[0] as object)).toHaveLength(76);
    expect(rows[0]?.AstroRef).toBe(' ');
    const normalized = normalizeHipMainRow(rows[0]!);
    expect(normalized.muAlphaStarMasPerYear).toBe(523.39);
    expect(normalized.covariance[1]?.[0]).toBeCloseTo(0.01 * 0.36 * 0.42, 15);
    expect(normalized.covariance[0]?.[1]).toBe(normalized.covariance[1]?.[0]);
    expect(normalized.covariance[2]?.[2]).toBeCloseTo(0.56 * 0.56, 15);
  });

  it('fails closed on header drift, short rows, duplicates and non-decimal values', () => {
    expect(() => parseHipMainCsv(`${header.replace('pmRA', 'pmRAx')}\n${hipRow()}\n`)).toThrow(
      /header/,
    );
    expect(() => parseHipMainCsv(`${header}\n746,1,2\n`)).toThrow(/76/);
    expect(() => parseHipMainCsv(`${header}\n${hipRow()}\n${hipRow()}\n`)).toThrow(/Duplicate/);
    const bad = parseHipMainCsv(`${header}\n${hipRow({ Plx: 'n/a' })}\n`);
    expect(() => normalizeHipMainRow(bad[0]!)).toThrow(/decimal/);
  });

  it('enforces the 2D.1E gate C record', () => {
    const row = parseHipMainCsv(
      `${header}\n${hipRow({ Ncomp: '2', MultFlag: 'C', AstroRef: 'A', m_HIP: 'AB' })}\n`,
    )[0]!;
    expect(() =>
      verifyGateC(row, { hip: 746, componentCount: 2, astroRef: 'A', multFlag: 'C', mHip: 'AB' }),
    ).not.toThrow();
    expect(() =>
      verifyGateC(row, { hip: 746, componentCount: 2, astroRef: 'A', multFlag: 'C', mHip: 'AC' }),
    ).toThrow(/gate C/);
  });

  it('reproduces the Amendment A1 bound for HIP 746 (0.081 mas per km/s to J2040.0)', () => {
    const normalized = normalizeHipMainRow(parseHipMainCsv(`${header}\n${hipRow()}\n`)[0]!);
    expect(radialVelocityOmissionBound(normalized, 1991.25, 2040)).toBeCloseTo(0.0806, 4);
  });
});

describe('IERS parsers', () => {
  const ntpList = (declared?: string) => {
    const update = '3992312697';
    const expiry = '4023129600';
    const data = ['2272060800\t10', '2287785600\t11'];
    const sha1 = createHash('sha1')
      .update([update, expiry, '227206080010', '228778560011'].join(''))
      .digest('hex');
    const hash = declared ?? sha1.replace(/(.{8})/g, '$1 ').trim();
    return `#$\t ${update}\n#@\t${expiry}\n${data.join('\n')}\n#h\t${hash}\n`;
  };

  it('verifies the NTP leap-list publisher SHA-1 and converts NTP to MJD', () => {
    const list = parseNtpLeapList(ntpList());
    expect(list.publisherIntegrity).toBe('VERIFIED');
    expect(list.transitions[0]).toEqual({
      ntpSeconds: 2272060800,
      effectiveMjd: 41317,
      taiMinusUtcSeconds: 10,
    });
    expect(parseNtpLeapList(ntpList('0000')).publisherIntegrity).toBe('MISMATCH');
  });

  it('checks Bulletin C announcements against the leap transitions', () => {
    const list = parseNtpLeapList(ntpList());
    const positive = parseBulletinC(
      'Bulletin C 1\nA positive leap second will be introduced at the end of June 1972.',
    );
    expect(positive.followingMjd).toBe(41499);
    expect(bulletinCConsistency(list, [positive])).toBe('CONSISTENT');
    const none = parseBulletinC(
      'Bulletin C 2\nNO leap second will be introduced at the end of June 1972.',
    );
    expect(bulletinCConsistency(list, [none])).toBe('INCONSISTENT');
    expect(() =>
      parseBulletinC(
        'Bulletin C 3\nA negative leap second will be introduced at the end of June 2030.',
      ),
    ).toThrow();
  });

  it('parses Bulletin B Section 1 finals separately from the preliminary extension', () => {
    const row = (d: number, mjd: number) =>
      `2025   9  ${String(d).padStart(2)}   ${mjd}  234.395  389.247   85.6748    0.349  0.162    0.035    0.027    0.1872  2.106  0.092`;
    const text = [
      ' BULLETIN B 999',
      ' 1 - DAILY FINAL VALUES OF x, y, UT1-UTC, dX, dY',
      ' Angular unit is milliarcsecond (mas), time unit is millisecond (ms).',
      ' Synthetic solution - consistent with ITRF 2014.',
      ' Final values',
      row(2, 60920),
      row(3, 60921),
      ' Preliminary extension',
      row(4, 60922),
      ' 2 - DAILY FINAL VALUES OF CELESTIAL POLE OFFSETS',
    ].join('\n');
    const section = parseBulletinBSection1(text);
    expect(section.finals.map((r) => r.mjd)).toEqual([60920, 60921]);
    expect(section.preliminary.map((r) => r.mjd)).toEqual([60922]);
    expect(() => parseBulletinBSection1(text.replace(row(3, 60921), row(3, 60925)))).toThrow();
  });
});

describe('canonical JSON', () => {
  it('sorts keys, normalizes NFC and negative zero, and rejects non-finite numbers', () => {
    expect(canonicalJson({ b: -0, a: 'é' })).toBe('{\n  "a": "é",\n  "b": 0\n}\n');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });
});
