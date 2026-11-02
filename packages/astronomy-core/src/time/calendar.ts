/*
 * UFUQ derived work: `gregorianToModifiedJulianDay` uses computations derived from IAU
 * SOFA 2023-10-11 `iauCal2jd`; not software provided by or endorsed by SOFA.
 * Differences: returns the MJD alone (the fixed first part is DJM0) and rejects invalid
 * dates instead of returning SOFA's -3 warning with a result. See
 * ../astrometry/SOFA_DERIVED_NOTICE.md.
 */

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  const base = MONTH_LENGTHS[month - 1];
  if (base === undefined) return 0;
  return base + (month === 2 && isGregorianLeapYear(year) ? 1 : 0);
}

/** Integer Modified Julian Day of a valid Gregorian date (SOFA `iauCal2jd` arithmetic). */
export function gregorianToModifiedJulianDay(year: number, month: number, day: number): number {
  if (!Number.isInteger(year) || year < -4799) throw new RangeError('Year out of range.');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Bad month.');
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError('Bad day.');
  }
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

/** Gregorian civil date of an integer Modified Julian Day (inverse of the above). */
export function modifiedJulianDayToGregorian(mjd: number): {
  year: number;
  month: number;
  day: number;
} {
  if (!Number.isInteger(mjd)) throw new RangeError('MJD must be an integer day.');
  // Fliegel & Van Flandern (1968) integer algorithm on JD = MJD + 2400001 (noon-based).
  let l = mjd + 2400001 + 68569;
  const n = Math.trunc((4 * l) / 146097);
  l = l - Math.trunc((146097 * n + 3) / 4);
  const i = Math.trunc((4000 * (l + 1)) / 1461001);
  l = l - Math.trunc((1461 * i) / 4) + 31;
  const k = Math.trunc((80 * l) / 2447);
  const day = l - Math.trunc((2447 * k) / 80);
  l = Math.trunc(k / 11);
  const month = k + 2 - 12 * l;
  const year = 100 * (n - 49) + i + l;
  return { year, month, day };
}

export function formatIsoDate(date: { year: number; month: number; day: number }): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(
    date.day,
  ).padStart(2, '0')}`;
}
