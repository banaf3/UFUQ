/**
 * ScientificProfileV1 UTC input grammar, leap validation, and typed time states.
 *
 * The only accepted text is `YYYY-MM-DDTHH:mm:ssZ` (whole seconds, uppercase T/Z).
 * Second 60 is accepted lexically only as `23:59:60Z` and becomes a validated instant
 * only when the supplied approved leap state confirms a positive leap second at the end
 * of that exact UTC date. No current time, local time, offset, fraction, Unix time, or
 * bare Julian Date is accepted (PHASE1_SCIENTIFIC_PROFILE_V1.md, UTC contract).
 *
 * UFUQ derived work: `taiFromUtc`, `julianDateToCalendar`, `ttFromTai` and `ut1FromTai`
 * use computations derived from IAU SOFA 2023-10-11 (utctai, jd2cal, taitt, taiut1); not
 * software provided by or endorsed by SOFA. Difference: TAI-UTC comes from the approved
 * leap artifact, never from iauDat. See ../astrometry/SOFA_DERIVED_NOTICE.md.
 */
import { DAYSEC, DJM0, TTMTAI } from '../astrometry/constants.js';
import {
  type ArtifactAvailability,
  type ArtifactIdentity,
  type ExecutionScope,
  isApprovedFor,
  type ScientificApproval,
} from '../common/provenance.js';
import { daysInMonth, gregorianToModifiedJulianDay } from './calendar.js';

export interface SuppliedCanonicalUtcText {
  readonly kind: 'SUPPLIED_CANONICAL_UTC_TEXT';
  readonly text: string;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export type TimeOutcomeCode =
  | 'TIMESTAMP_SYNTAX_INVALID'
  | 'LEAP_SECOND_INSTANT_INVALID'
  | 'LEAP_VALIDATION_DATA_UNAVAILABLE'
  | 'TIME_OR_EOP_STATE_NOT_APPROVED'
  | 'REQUIRED_TIME_SCALE_UNAVAILABLE';

export interface TimeFailure {
  readonly ok: false;
  readonly outcome: TimeOutcomeCode;
  readonly detail: string;
}

const CANONICAL_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/** Stage 1: grammar and Gregorian civil-field validation only. */
export function parseCanonicalUtc(
  text: unknown,
): { readonly ok: true; readonly value: SuppliedCanonicalUtcText } | TimeFailure {
  if (typeof text !== 'string') {
    return { ok: false, outcome: 'TIMESTAMP_SYNTAX_INVALID', detail: 'Timestamp must be text.' };
  }
  const match = CANONICAL_UTC.exec(text);
  if (!match) {
    return {
      ok: false,
      outcome: 'TIMESTAMP_SYNTAX_INVALID',
      detail: 'Expected YYYY-MM-DDTHH:mm:ssZ.',
    };
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const invalid = (detail: string): TimeFailure => ({
    ok: false,
    outcome: 'TIMESTAMP_SYNTAX_INVALID',
    detail,
  });
  if (month < 1 || month > 12) return invalid('Month out of range.');
  if (day < 1 || day > daysInMonth(year, month)) return invalid('Day out of range.');
  if (hour > 23) return invalid('Hour out of range.');
  if (minute > 59) return invalid('Minute out of range.');
  if (second > 60) return invalid('Second out of range.');
  if (second === 60 && (hour !== 23 || minute !== 59)) {
    return invalid('Second 60 is only structurally eligible as 23:59:60Z.');
  }
  return {
    ok: true,
    value: { kind: 'SUPPLIED_CANONICAL_UTC_TEXT', text, year, month, day, hour, minute, second },
  };
}

export interface LeapTransition {
  /** Integer MJD (UTC) from whose 0h the new TAI-UTC applies. */
  readonly effectiveMjd: number;
  /** TAI-UTC in SI seconds from that instant. */
  readonly taiMinusUtcSeconds: number;
}

export type PublisherIntegrity = 'VERIFIED' | 'MISMATCH' | 'NOT_DECLARED';

/** The approved leap-second state (Bulletin C authority; IERS/IANA machine transport). */
export interface ApprovedLeapState {
  readonly identity: ArtifactIdentity;
  readonly availability: ArtifactAvailability;
  readonly publisherIntegrity: PublisherIntegrity;
  readonly bulletinCConsistency: 'CONSISTENT' | 'INCONSISTENT' | 'NOT_CHECKED';
  /** Integer MJD (UTC) of the publisher's expiry date (file valid before its 0h). */
  readonly expiryMjd: number;
  readonly transitions: readonly LeapTransition[];
  readonly approval: ScientificApproval;
}

export interface ValidatedUtcInstant {
  readonly kind: 'VALIDATED_UTC_INSTANT';
  readonly text: string;
  readonly mjd: number;
  /** Elapsed UTC seconds of the day, 0..86400 (86400 only for a validated 23:59:60). */
  readonly secondsOfDay: number;
  /** Length of this UTC day in SI seconds (86400 or 86401). */
  readonly dayLengthSeconds: number;
  /** TAI-UTC applying at this instant (the pre-leap value during 23:59:60). */
  readonly taiMinusUtcSeconds: number;
  readonly leapIdentity: ArtifactIdentity;
}

function taiMinusUtcFor(state: ApprovedLeapState, mjd: number): number | undefined {
  let value: number | undefined;
  for (const transition of state.transitions) {
    if (transition.effectiveMjd <= mjd) value = transition.taiMinusUtcSeconds;
    else break;
  }
  return value;
}

/** Validates leap-artifact use structurally (ordered, integer, unit steps after 1972). */
export function leapStateIsWellFormed(state: ApprovedLeapState): boolean {
  if (state.transitions.length === 0) return false;
  return state.transitions.every((transition, index) => {
    if (!Number.isInteger(transition.effectiveMjd)) return false;
    if (!Number.isFinite(transition.taiMinusUtcSeconds)) return false;
    if (index === 0) return true;
    const previous = state.transitions[index - 1] as LeapTransition;
    return (
      transition.effectiveMjd > previous.effectiveMjd &&
      Math.abs(transition.taiMinusUtcSeconds - previous.taiMinusUtcSeconds) === 1
    );
  });
}

/** Stage 3: resolve/verify/approve the leap state and build a ValidatedUtcInstant. */
export function validateUtcInstant(
  supplied: SuppliedCanonicalUtcText,
  leap: ApprovedLeapState | undefined,
  scope: ExecutionScope,
): { readonly ok: true; readonly value: ValidatedUtcInstant } | TimeFailure {
  if (leap === undefined) {
    return {
      ok: false,
      outcome: 'LEAP_VALIDATION_DATA_UNAVAILABLE',
      detail: 'No leap artifact.',
    };
  }
  if (leap.availability !== 'AVAILABLE' || leap.publisherIntegrity !== 'VERIFIED') {
    return {
      ok: false,
      outcome: 'LEAP_VALIDATION_DATA_UNAVAILABLE',
      detail: 'Leap artifact unavailable or not integrity-verified.',
    };
  }
  if (leap.bulletinCConsistency !== 'CONSISTENT' || !leapStateIsWellFormed(leap)) {
    return {
      ok: false,
      outcome: 'LEAP_VALIDATION_DATA_UNAVAILABLE',
      detail: 'Leap artifact inconsistent with Bulletin C or malformed.',
    };
  }
  if (!isApprovedFor(leap.approval, scope)) {
    return {
      ok: false,
      outcome: 'TIME_OR_EOP_STATE_NOT_APPROVED',
      detail: `Leap artifact approval is ${leap.approval.state} for ${leap.approval.scope}.`,
    };
  }
  const mjd = gregorianToModifiedJulianDay(supplied.year, supplied.month, supplied.day);
  if (mjd >= leap.expiryMjd) {
    return {
      ok: false,
      outcome: 'LEAP_VALIDATION_DATA_UNAVAILABLE',
      detail: 'Leap artifact is expired for the requested date (EXPIRED_FOR_REQUEST).',
    };
  }
  const taiMinusUtc = taiMinusUtcFor(leap, mjd);
  if (taiMinusUtc === undefined) {
    return {
      ok: false,
      outcome: 'REQUIRED_TIME_SCALE_UNAVAILABLE',
      detail: 'The leap artifact does not cover dates before its first transition.',
    };
  }
  const next = taiMinusUtcFor(leap, mjd + 1) as number;
  const step = next - taiMinusUtc;
  if (step < 0) {
    return {
      ok: false,
      outcome: 'REQUIRED_TIME_SCALE_UNAVAILABLE',
      detail: 'A negative leap second requires a new versioned grammar decision.',
    };
  }
  if (supplied.second === 60 && step !== 1) {
    return {
      ok: false,
      outcome: 'LEAP_SECOND_INSTANT_INVALID',
      detail: 'No positive leap second at the end of this UTC date.',
    };
  }
  return {
    ok: true,
    value: {
      kind: 'VALIDATED_UTC_INSTANT',
      text: supplied.text,
      mjd,
      secondsOfDay: 3600 * supplied.hour + 60 * supplied.minute + supplied.second,
      dayLengthSeconds: DAYSEC + step,
      taiMinusUtcSeconds: taiMinusUtc,
      leapIdentity: leap.identity,
    },
  };
}

/** TAI-UTC at 0h UTC of an integer MJD, from an already approved leap state. */
export function taiMinusUtcAtMjd(leap: ApprovedLeapState, mjd: number): number | undefined {
  return taiMinusUtcFor(leap, mjd);
}

export type TwoPartScale = 'UTC_QUASI_JD' | 'TAI' | 'TT' | 'TDB' | 'UT1';

export interface TwoPartJulianDate<S extends TwoPartScale> {
  readonly scale: S;
  readonly splitConvention: 'MJD_ZERO_PLUS_OFFSET';
  /** Always 2400000.5. */
  readonly part1: number;
  /** MJD including the day fraction. */
  readonly part2: number;
}

function twoPart<S extends TwoPartScale>(scale: S, part2: number): TwoPartJulianDate<S> {
  return { scale, splitConvention: 'MJD_ZERO_PLUS_OFFSET', part1: DJM0, part2 };
}

/** UTC quasi-JD (SOFA convention: the day fraction is scaled by this day's length). */
export function utcQuasiJulianDate(
  instant: ValidatedUtcInstant,
): TwoPartJulianDate<'UTC_QUASI_JD'> {
  return twoPart('UTC_QUASI_JD', instant.mjd + instant.secondsOfDay / instant.dayLengthSeconds);
}

/** TAI from a validated UTC instant (equivalent to SOFA `iauUtctai` after 1972). */
export function taiFromUtc(instant: ValidatedUtcInstant): TwoPartJulianDate<'TAI'> {
  // Derived from SOFA iauUtctai with big1 true (u1 = DJM0, u2 = the UTC quasi-JD part2),
  // using the approved leap state instead of iauDat. After 1972 TAI-UTC has no drift,
  // so dat12 = dat0 and dlod = 0; dleap is this UTC day's leap step.
  const u1 = DJM0;
  const u2 = utcQuasiJulianDate(instant).part2;
  const { fd: fraction } = julianDateToCalendar(u1, u2);
  const dleap = instant.dayLengthSeconds - DAYSEC;
  let fd = fraction * ((DAYSEC + dleap) / DAYSEC);
  fd *= (DAYSEC + 0.0) / DAYSEC;
  let a2 = DJM0 - u1;
  a2 += instant.mjd;
  a2 += fd + instant.taiMinusUtcSeconds / DAYSEC;
  return twoPart('TAI', a2);
}

/**
 * Derived from SOFA iauJd2cal: Gregorian calendar date and day fraction from a two-part
 * Julian Date, with Klein compensated summation of the fractions.
 */
export function julianDateToCalendar(
  dj1: number,
  dj2: number,
): { readonly year: number; readonly month: number; readonly day: number; readonly fd: number } {
  const DBL_EPSILON = 2.220446049250313e-16;
  const dnint = (a: number) =>
    Math.abs(a) < 0.5 ? 0.0 : a < 0.0 ? Math.ceil(a - 0.5) : Math.floor(a + 0.5);
  const dj = dj1 + dj2;
  if (dj < -68569.5 || dj > 1e9) throw new RangeError('Julian Date outside the jd2cal range.');
  let d = dnint(dj1);
  const f1 = dj1 - d;
  let jd = Math.trunc(d);
  d = dnint(dj2);
  const f2 = dj2 - d;
  jd += Math.trunc(d);
  let s = 0.5;
  let cs = 0.0;
  for (const x of [f1, f2]) {
    const t = s + x;
    cs += Math.abs(s) >= Math.abs(x) ? s - t + x : x - t + s;
    s = t;
    if (s >= 1.0) {
      jd++;
      s -= 1.0;
    }
  }
  let f = s + cs;
  cs = f - s;
  if (f < 0.0) {
    f = s + 1.0;
    cs += 1.0 - f + s;
    s = f;
    f = s + cs;
    cs = f - s;
    jd--;
  }
  if (f - 1.0 >= -DBL_EPSILON / 4.0) {
    const t = s - 1.0;
    cs += s - t - 1.0;
    s = t;
    f = s + cs;
    if (-DBL_EPSILON / 2.0 < f) {
      jd++;
      f = Math.max(f, 0.0);
    }
  }
  let l = jd + 68569;
  const n = Math.trunc((4 * l) / 146097);
  l -= Math.trunc((146097 * n + 3) / 4);
  const i = Math.trunc((4000 * (l + 1)) / 1461001);
  l -= Math.trunc((1461 * i) / 4) - 31;
  const k = Math.trunc((80 * l) / 2447);
  const day = l - Math.trunc((2447 * k) / 80);
  l = Math.trunc(k / 11);
  return { year: 100 * (n - 49) + i + l, month: k + 2 - 12 * l, day, fd: f };
}

/** SOFA `iauTaitt` semantics: TT = TAI + 32.184 s. */
export function ttFromTai(tai: TwoPartJulianDate<'TAI'>): TwoPartJulianDate<'TT'> {
  return twoPart('TT', tai.part2 + TTMTAI / DAYSEC);
}

/** SOFA `iauTaiut1` semantics: UT1 = TAI + (UT1-TAI). */
export function ut1FromTai(
  tai: TwoPartJulianDate<'TAI'>,
  ut1MinusTaiSeconds: number,
): TwoPartJulianDate<'UT1'> {
  return twoPart('UT1', tai.part2 + ut1MinusTaiSeconds / DAYSEC);
}

/** Orders two validated instants chronologically (leap second sorts before next day). */
export function compareUtcInstants(
  left: Pick<ValidatedUtcInstant, 'mjd' | 'secondsOfDay'>,
  right: Pick<ValidatedUtcInstant, 'mjd' | 'secondsOfDay'>,
): number {
  return left.mjd !== right.mjd ? left.mjd - right.mjd : left.secondsOfDay - right.secondsOfDay;
}
