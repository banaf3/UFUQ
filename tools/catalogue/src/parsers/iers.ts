/**
 * Fail-closed parsers for the selected IERS artifacts (Milestone 2D.2): the NTP-format
 * leap-second list, Bulletin C announcements, and Bulletin B Section 1 daily values.
 */
import { sha1Hex } from '../canonical-json.js';

const NTP_MINUS_MJD_DAYS = 15020;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface NtpLeapList {
  readonly updateNtp: number;
  readonly expiryNtp: number;
  readonly expiryMjd: number;
  readonly declaredSha1: string;
  readonly computedSha1: string;
  readonly publisherIntegrity: 'VERIFIED' | 'MISMATCH';
  readonly publicDomainStatement: boolean;
  readonly transitions: readonly {
    readonly ntpSeconds: number;
    readonly effectiveMjd: number;
    readonly taiMinusUtcSeconds: number;
  }[];
}

/** NTP seconds to integer MJD; leap-list instants are exactly 0h UTC. */
export function ntpToMjd(ntp: number): number {
  if (ntp % 86400 !== 0) throw new RangeError(`NTP ${ntp} is not a 0h UTC instant.`);
  return ntp / 86400 + NTP_MINUS_MJD_DAYS;
}

export function parseNtpLeapList(text: string): NtpLeapList {
  const lines = text.split(/\r?\n/);
  const field = (prefix: string) => {
    const matches = lines.filter((line) => line.startsWith(prefix));
    if (matches.length !== 1)
      throw new SyntaxError(`Leap list must contain exactly one ${prefix} line.`);
    return (matches[0] as string).slice(prefix.length).trim();
  };
  const update = field('#$');
  const expiry = field('#@');
  const declaredSha1 = field('#h').replace(/\s+/g, '').toLowerCase();
  const dataLines = lines.filter((line) => line.length > 0 && !line.startsWith('#'));
  const transitions = dataLines.map((line) => {
    const match = /^(\d+)\s+(\d+)\s*(?:#.*)?$/.exec(line);
    if (!match) throw new SyntaxError(`Unrecognized leap-list data line: ${line}`);
    const ntpSeconds = Number(match[1]);
    return { ntpSeconds, effectiveMjd: ntpToMjd(ntpSeconds), taiMinusUtcSeconds: Number(match[2]) };
  });
  if (!/^\d+$/.test(update) || !/^\d+$/.test(expiry)) throw new SyntaxError('Bad #$ or #@ value.');
  const hashInput = [
    update,
    expiry,
    ...transitions.map((t) => `${t.ntpSeconds}${t.taiMinusUtcSeconds}`),
  ]
    .join('')
    .replace(/\s+/g, '');
  const computedSha1 = sha1Hex(Buffer.from(hashInput, 'ascii'));
  return {
    updateNtp: Number(update),
    expiryNtp: Number(expiry),
    expiryMjd: ntpToMjd(Number(expiry)),
    declaredSha1,
    computedSha1,
    publisherIntegrity: declaredSha1 === computedSha1 ? 'VERIFIED' : 'MISMATCH',
    publicDomainStatement: /This file is in the public domain\./.test(text),
    transitions,
  };
}

export interface BulletinCAnnouncement {
  readonly issue: number;
  readonly announcement: 'NO_LEAP_SECOND' | 'POSITIVE_LEAP_SECOND' | 'NEGATIVE_LEAP_SECOND';
  /** Integer MJD of the 0h UTC instant following the announced opportunity. */
  readonly followingMjd: number;
}

function monthEndFollowingMjd(monthName: string, year: number): number {
  const month = MONTHS.indexOf(monthName) + 1;
  if (month < 1) throw new SyntaxError(`Unknown month ${monthName}.`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const my = Math.trunc((nextMonth - 14) / 12);
  const iypmy = nextYear + my;
  return (
    Math.trunc((1461 * (iypmy + 4800)) / 4) +
    Math.trunc((367 * (nextMonth - 2 - 12 * my)) / 12) -
    Math.trunc((3 * Math.trunc((iypmy + 4900) / 100)) / 4) +
    1 -
    2432076
  );
}

export function parseBulletinC(text: string): BulletinCAnnouncement {
  const issue = Number(/Bulletin C (\d+)/.exec(text)?.[1]);
  if (!Number.isInteger(issue)) throw new SyntaxError('Bulletin C issue number not found.');
  if (/negative leap second will be introduced/i.test(text)) {
    throw new SyntaxError(
      `Bulletin C ${issue} announces a negative leap second; V1 cannot classify it.`,
    );
  }
  const positive = /A positive leap second will be introduced at the end of (\w+) (\d{4})/.exec(
    text,
  );
  const none = /NO leap second will be introduced at the end of (\w+) (\d{4})/.exec(text);
  const match = positive ?? none;
  if (!match || (positive && none)) throw new SyntaxError(`Bulletin C ${issue} is unclassified.`);
  return {
    issue,
    announcement: positive ? 'POSITIVE_LEAP_SECOND' : 'NO_LEAP_SECOND',
    followingMjd: monthEndFollowingMjd(match[1] as string, Number(match[2])),
  };
}

/** Checks that every Bulletin C announcement agrees with the leap list's transitions. */
export function bulletinCConsistency(
  list: NtpLeapList,
  announcements: readonly BulletinCAnnouncement[],
): 'CONSISTENT' | 'INCONSISTENT' {
  const steps = new Set(
    list.transitions.slice(1).map((t, i) => {
      const previous = list.transitions[i] as NtpLeapList['transitions'][number];
      return t.taiMinusUtcSeconds - previous.taiMinusUtcSeconds === 1 ? t.effectiveMjd : -1;
    }),
  );
  const ok = announcements.every((a) =>
    a.announcement === 'POSITIVE_LEAP_SECOND'
      ? steps.has(a.followingMjd)
      : !steps.has(a.followingMjd),
  );
  return ok ? 'CONSISTENT' : 'INCONSISTENT';
}

export interface BulletinBRow {
  readonly mjd: number;
  readonly civil: { readonly year: number; readonly month: number; readonly day: number };
  /** x, y (mas), UT1-UTC (ms), dX, dY (mas), and their formal errors, in source order. */
  readonly values: readonly number[];
}

export interface BulletinBSection1 {
  readonly issue: number;
  readonly seriesLabel: string;
  readonly finals: readonly BulletinBRow[];
  readonly preliminary: readonly BulletinBRow[];
}

const ROW = /^(\d{4})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{5})((?:\s+-?\d+\.\d+){10})\s*$/;

function civilToMjd(year: number, month: number, day: number): number {
  const my = Math.trunc((month - 14) / 12);
  const iypmy = year + my;
  return (
    Math.trunc((1461 * (iypmy + 4800)) / 4) +
    Math.trunc((367 * (month - 2 - 12 * my)) / 12) -
    Math.trunc((3 * Math.trunc((iypmy + 4900) / 100)) / 4) +
    day -
    2432076
  );
}

export function parseBulletinBSection1(text: string): BulletinBSection1 {
  const lines = text.split(/\r?\n/);
  const issue = Number(/BULLETIN B (\d+)/.exec(text)?.[1]);
  if (!Number.isInteger(issue)) throw new SyntaxError('Bulletin B issue number not found.');
  const header = lines.findIndex((line) =>
    /^\s*1 - DAILY FINAL VALUES OF x, y, UT1-UTC, dX, dY/.test(line),
  );
  const units = lines.findIndex((line) =>
    /Angular unit is milliarcsecond \(mas\), time unit is millisecond \(ms\)/.test(line),
  );
  const label = lines.find((line) => /consistent with ITRF/.test(line));
  const finalStart = lines.findIndex((line) => /^\s*Final values\s*$/.test(line));
  const preliminaryStart = lines.findIndex((line) => /^\s*Preliminary extension\s*$/.test(line));
  const sectionEnd = lines.findIndex((line) => /^\s*2 - DAILY FINAL VALUES/.test(line));
  if (header < 0 || units < 0 || label === undefined) {
    throw new SyntaxError(`Bulletin B ${issue}: Section 1 header, units, or series label missing.`);
  }
  if (!(finalStart > header && preliminaryStart > finalStart && sectionEnd > preliminaryStart)) {
    throw new SyntaxError(`Bulletin B ${issue}: unexpected Section 1 structure.`);
  }
  const rows = (from: number, to: number) =>
    lines.slice(from + 1, to).flatMap((line) => {
      const match = ROW.exec(line);
      if (!match) return [];
      const civil = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
      const mjd = Number(match[4]);
      if (civilToMjd(civil.year, civil.month, civil.day) !== mjd) {
        throw new SyntaxError(`Bulletin B ${issue}: civil date and MJD ${mjd} disagree.`);
      }
      const values = (match[5] as string).trim().split(/\s+/).map(Number);
      return [{ mjd, civil, values }];
    });
  const finals = rows(finalStart, preliminaryStart);
  if (finals.length === 0) throw new SyntaxError(`Bulletin B ${issue}: no final rows.`);
  finals.forEach((row, index) => {
    if (index > 0 && row.mjd !== (finals[index - 1] as BulletinBRow).mjd + 1) {
      throw new SyntaxError(
        `Bulletin B ${issue}: final rows are not contiguous at MJD ${row.mjd}.`,
      );
    }
    if (!(row.values[5]! > 0 && row.values[6]! > 0 && row.values[7]! > 0)) {
      throw new SyntaxError(
        `Bulletin B ${issue}: nonpositive x/y/UT1 formal error at MJD ${row.mjd}.`,
      );
    }
  });
  return {
    issue,
    seriesLabel: label.trim(),
    finals,
    preliminary: rows(preliminaryStart, sectionEnd),
  };
}
