/*
 * UFUQ derived work: uses constants derived from IAU SOFA 2023-10-11 `sofam.h`; not
 * software provided by or endorsed by SOFA. See SOFA_DERIVED_NOTICE.md.
 */

/** Pi. */
export const DPI = 3.141592653589793238462643;
/** 2 Pi. */
export const D2PI = 6.283185307179586476925287;
/** Radians to degrees. */
export const DR2D = 57.29577951308232087679815;
/** Degrees to radians. */
export const DD2R = 1.745329251994329576923691e-2;
/** Radians to arcseconds. */
export const DR2AS = 206264.8062470963551564734;
/** Arcseconds to radians. */
export const DAS2R = 4.848136811095359935899141e-6;
/** Arcseconds in a full circle. */
export const TURNAS = 1296000.0;
/** Milliarcseconds to radians. */
export const DMAS2R = DAS2R / 1e3;
/** Seconds per day. */
export const DAYSEC = 86400.0;
/** Days per Julian year. */
export const DJY = 365.25;
/** Days per Julian century. */
export const DJC = 36525.0;
/** Days per Julian millennium. */
export const DJM = 365250.0;
/** Reference epoch (J2000.0), Julian Date. */
export const DJ00 = 2451545.0;
/** Julian Date of Modified Julian Date zero. */
export const DJM0 = 2400000.5;
/** Reference epoch (J2000.0), Modified Julian Date. */
export const DJM00 = 51544.5;
/** TT minus TAI (s). */
export const TTMTAI = 32.184;
/** Astronomical unit (m, IAU 2012). */
export const DAU = 149597870.7e3;
/** Speed of light (m/s). */
export const CMPS = 299792458.0;
/** Light time for 1 au (s). */
export const AULT = DAU / CMPS;
/** Speed of light (au per day). */
export const DC = DAYSEC / AULT;
/** Schwarzschild radius of the Sun (au) = 2 * 1.32712440041e20 / (2.99792458e8)^2 / 1.49597870700e11. */
export const SRS = 1.97412574336e-8;

/** SOFA `dsign(A,B)`: magnitude of A with the sign of B. */
export function dsign(magnitude: number, signSource: number): number {
  return signSource < 0.0 ? -Math.abs(magnitude) : Math.abs(magnitude);
}
