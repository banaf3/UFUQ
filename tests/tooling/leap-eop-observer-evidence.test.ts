import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// Exercises the Milestone 2D.2/2D.3 evidence-screen parsers on SYNTHETIC inputs.
// Numbers below are test vectors chosen for structure only; they are not IERS data,
// observer coordinates, or any approved value.

interface NtpLeapList {
  updateNtp: number;
  expiryUtcDate: string;
  transitions: { ntp: number; taiMinusUtc: number }[];
  publisherIntegrity: 'VERIFIED' | 'MISMATCH';
  publicDomainStatement: boolean;
}
interface BulletinC {
  issue: number;
  announcement: string;
  opportunity?: string;
  currentFromDate?: string;
  currentTaiMinusUtc?: number;
}
interface BulletinBSection1 {
  issue: number;
  seriesLabel?: string;
  structure: string;
  finalRowCount: number;
  finalFirstDate?: string;
  finalLastDate?: string;
  preliminaryRowCount: number;
  finalRowsContiguous: boolean;
  finalRowsCivilDateMatchesMjd: boolean;
  finalRowsPositiveXYUt1Errors: boolean;
}
interface LeapEopScreen {
  parseNtpLeapList(text: string): NtpLeapList;
  parseBulletinC(text: string): BulletinC;
  parseBulletinBSection1(text: string): BulletinBSection1;
  listTarMembers(bytes: Buffer): { path: string; size: number; type: string; bytes: Buffer }[];
}
interface Point {
  lat: number;
  lon: number;
}
interface ObserverScreen {
  haversineMetres(a: Point, b: Point): number;
  pointInRing(point: Point, ring: Point[]): boolean;
}

const scripts = join(import.meta.dirname, '..', '..', 'scripts', 'evidence');
let leap: LeapEopScreen;
let observer: ObserverScreen;

beforeAll(async () => {
  const leapUrl = pathToFileURL(join(scripts, 'screen-iers-leap-eop-v1.mjs')).href;
  const observerUrl = pathToFileURL(join(scripts, 'screen-observer-umpsa-pekan-v1.mjs')).href;
  leap = (await import(leapUrl)) as LeapEopScreen;
  observer = (await import(observerUrl)) as ObserverScreen;
});

function syntheticNtpList(tamper = false): string {
  const update = '3900000000';
  const expiry = '3944592000';
  const rows: [string, string][] = [
    ['2272060800', '10'],
    ['2287785600', tamper ? '12' : '11'],
  ];
  const digest = createHash('sha1')
    .update(
      update + expiry + rows.map(([ntp]) => ntp + (ntp === '2287785600' ? '11' : '10')).join(''),
    )
    .digest('hex');
  const grouped = digest.match(/.{8}/g)?.join(' ') ?? '';
  return [
    '#\tThis file is in the public domain.',
    `#$\t${update}`,
    `#@\t${expiry}`,
    ...rows.map(([ntp, dtai]) => `${ntp}\t${dtai}\t# synthetic`),
    `#h\t${grouped}`,
    '',
  ].join('\n');
}

describe('leap transport screen', () => {
  it('verifies the publisher SHA-1 integrity code and rejects a tampered row', () => {
    const parsed = leap.parseNtpLeapList(syntheticNtpList());
    expect(parsed.publisherIntegrity).toBe('VERIFIED');
    expect(parsed.transitions).toHaveLength(2);
    expect(parsed.publicDomainStatement).toBe(true);
    expect(parsed.expiryUtcDate).toBe('2024-12-31');
    expect(leap.parseNtpLeapList(syntheticNtpList(true)).publisherIntegrity).toBe('MISMATCH');
  });

  it('classifies Bulletin C announcements and the current UTC-TAI statement', () => {
    const none = leap.parseBulletinC(
      [
        'Paris, 1 January 2099',
        'Bulletin C 999',
        ' NO leap second will be introduced at the end of June 2099.',
        '     from 2017 January 1, 0h UTC, until further notice : UTC-TAI = -37 s',
      ].join('\n'),
    );
    expect(none).toMatchObject({
      issue: 999,
      announcement: 'NO_LEAP_SECOND',
      opportunity: 'June 2099',
      currentFromDate: '2017-01-01',
      currentTaiMinusUtc: 37,
    });
    const positive = leap.parseBulletinC(
      'Bulletin C 998\n A positive leap second will be introduced at the end of December 2098.\n',
    );
    expect(positive.announcement).toBe('POSITIVE_LEAP_SECOND');
    expect(leap.parseBulletinC('Bulletin C 997\nunrelated text\n').announcement).toBe(
      'UNCLASSIFIED',
    );
  });
});

function syntheticBulletinB(days: number[]): string {
  const row = (day: number): string =>
    `2099   1  ${String(day).padStart(2, ' ')}   ${Date.UTC(2099, 0, day) / 86400000 + 40587}    1.000    2.000    3.0000    0.100  0.100    0.040    0.040    0.0200  0.100  0.100`;
  return [
    '                 BULLETIN B 999',
    '        1 March 2099',
    ' 1 - DAILY FINAL VALUES OF x, y, UT1-UTC, dX, dY',
    ' Synthetic solution - consistent with ITRF 9999.',
    ' Final values ',
    ...days.map(row),
    ' Preliminary extension ',
    row(days.at(-1)! + 1),
    ' 2 - DAILY FINAL VALUES OF CELESTIAL POLE OFFSETS dPsi1980 & dEps1980',
    '',
  ].join('\n');
}

describe('Bulletin B Section 1 screen', () => {
  it('separates final rows from the preliminary extension and checks date/MJD agreement', () => {
    const parsed = leap.parseBulletinBSection1(syntheticBulletinB([1, 2, 3]));
    expect(parsed).toMatchObject({
      issue: 999,
      seriesLabel: 'Synthetic solution - consistent with ITRF 9999.',
      structure: 'SECTION1_FINAL_THEN_PRELIMINARY',
      finalRowCount: 3,
      finalFirstDate: '2099-01-01',
      finalLastDate: '2099-01-03',
      preliminaryRowCount: 1,
      finalRowsContiguous: true,
      finalRowsCivilDateMatchesMjd: true,
      finalRowsPositiveXYUt1Errors: true,
    });
  });

  it('reports a gap in the final rows', () => {
    expect(leap.parseBulletinBSection1(syntheticBulletinB([1, 3])).finalRowsContiguous).toBe(false);
  });

  it('lists ustar members with their sizes', () => {
    const header = Buffer.alloc(512);
    header.write('pkg/chapter5/software/SYNTH.F', 0, 'latin1');
    header.write('00000000005\0', 124, 'latin1');
    header.write('0', 156, 'latin1');
    const data = Buffer.alloc(512);
    data.write('HELLO', 0, 'latin1');
    const members = leap.listTarMembers(Buffer.concat([header, data, Buffer.alloc(1024)]));
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ path: 'pkg/chapter5/software/SYNTH.F', size: 5, type: '0' });
    expect(members[0]?.bytes.toString('latin1')).toBe('HELLO');
  });
});

describe('observer evidence screen', () => {
  const square: Point[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 1, lon: 1 },
    { lat: 1, lon: 0 },
    { lat: 0, lon: 0 },
  ];

  it('tests containment in a closed ring', () => {
    expect(observer.pointInRing({ lat: 0.5, lon: 0.5 }, square)).toBe(true);
    expect(observer.pointInRing({ lat: 1.5, lon: 0.5 }, square)).toBe(false);
  });

  it('measures one degree of latitude on the mean sphere', () => {
    const metres = observer.haversineMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(Math.abs(metres - 111195.08)).toBeLessThan(0.1);
  });
});
