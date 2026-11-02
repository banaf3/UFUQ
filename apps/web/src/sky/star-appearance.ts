/**
 * How a star looks on screen (presentation only; it never decides visibility or scoring).
 *
 * Brightness: Pogson's magnitude scale (Pogson 1856, MNRAS 17, 12), flux ratio
 * 10^(-0.4 dm), compressed by the point-source brightness exponent 0.5 of Stevens' power
 * law (Stevens 1961, Science 133, 80). The drawn disc area follows that perceived
 * brightness, so the radius grows by 10^0.1 per magnitude. A screen cannot show the eye's
 * dynamic range, so the faintest 2.5 magnitudes also fade in opacity (to 35 % at the
 * catalogue limit): a display compromise, not a visibility model.
 *
 * Colour: Johnson B-V to temperature with Ballesteros (2012), EPL 97, 34008, Eq. 14; the
 * Planck spectrum is integrated against the CIE 1931 colour-matching functions in the
 * multi-lobe analytic fit of Wyman, Sloan & Shirley (2013), JCGT 2(2), Eq. 4 and Table 1;
 * XYZ goes to sRGB with the IEC 61966-2-1 matrix and transfer function.
 */

/** Ballesteros (2012) Eq. 14: blackbody temperature (K) from B-V. */
export function temperatureFromBV(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

function lobe(wavelength: number, mean: number, below: number, above: number): number {
  const t = (wavelength - mean) * (wavelength < mean ? below : above);
  return Math.exp(-0.5 * t * t);
}

/** CIE 1931 2-degree colour matching functions, Wyman et al. (2013) multi-lobe fit. */
export function cieXyzBar(wavelength: number): [number, number, number] {
  return [
    0.362 * lobe(wavelength, 442.0, 0.0624, 0.0374) +
      1.056 * lobe(wavelength, 599.8, 0.0264, 0.0323) -
      0.065 * lobe(wavelength, 501.1, 0.049, 0.0382),
    0.821 * lobe(wavelength, 568.8, 0.0213, 0.0247) +
      0.286 * lobe(wavelength, 530.9, 0.0613, 0.0322),
    1.217 * lobe(wavelength, 437.0, 0.0845, 0.0278) +
      0.681 * lobe(wavelength, 459.0, 0.0385, 0.0725),
  ];
}

/** Relative spectral radiance of a black body (Planck's law), wavelength in nm. */
function planck(wavelengthNm: number, temperature: number): number {
  const lambda = wavelengthNm * 1e-9;
  const c2 = 1.438776877e-2; // second radiation constant hc/k (m K), CODATA 2018
  return 1 / (lambda ** 5 * (Math.exp(c2 / (lambda * temperature)) - 1));
}

const encode = (linear: number) =>
  linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;

/** Display colour of a black body: sRGB in [0, 1], brightest channel normalised to 1. */
export function blackbodySrgb(temperature: number): [number, number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let wavelength = 380; wavelength <= 780; wavelength += 5) {
    const radiance = planck(wavelength, temperature);
    const [xb, yb, zb] = cieXyzBar(wavelength);
    x += radiance * xb;
    y += radiance * yb;
    z += radiance * zb;
  }
  // IEC 61966-2-1 (sRGB, D65) XYZ to linear RGB.
  const rgb = [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ].map((channel) => Math.max(0, channel));
  const peak = Math.max(...rgb);
  return rgb.map((channel) => encode(channel / peak)) as [number, number, number];
}

const LUT_MIN = -0.4;
const LUT_MAX = 2.2;
const LUT_STEP = 0.02;
let lut: [number, number, number][] | null = null;

/** Star colour from B-V through a precomputed table; white when B-V is unknown. */
export function starColor(bv: number | null): [number, number, number] {
  if (bv === null || !Number.isFinite(bv)) return [1, 1, 1];
  if (lut === null) {
    lut = [];
    for (let value = LUT_MIN; value <= LUT_MAX + 1e-9; value += LUT_STEP)
      lut.push(blackbodySrgb(temperatureFromBV(value)));
  }
  const index = Math.round((Math.min(LUT_MAX, Math.max(LUT_MIN, bv)) - LUT_MIN) / LUT_STEP);
  return lut[Math.min(lut.length - 1, index)] as [number, number, number];
}

export interface StarSprite {
  /** Gaussian core radius in CSS pixels. */
  readonly radius: number;
  /** Opacity in [0, 1]. */
  readonly alpha: number;
}

export const STAR_BASE_RADIUS = 1.0;
export const FADE_RANGE_MAGNITUDES = 2.5;
export const FAINTEST_OPACITY = 0.35;

/** Disc radius (CSS px) and opacity; the shader in SkyCanvas implements the same rule. */
export function starSprite(
  visualMagnitude: number,
  limitingMagnitude = 6.5,
  baseRadius = STAR_BASE_RADIUS,
): StarSprite {
  if (visualMagnitude > limitingMagnitude) return { radius: 0, alpha: 0 };
  // Perceived brightness relative to the limit: (10^(-0.4 dm))^0.5; disc area follows it.
  const perceived = 10 ** (-0.2 * (visualMagnitude - limitingMagnitude));
  const ramp = Math.min(1, (limitingMagnitude - visualMagnitude) / FADE_RANGE_MAGNITUDES);
  return {
    radius: baseRadius * Math.sqrt(perceived),
    alpha: FAINTEST_OPACITY + (1 - FAINTEST_OPACITY) * ramp,
  };
}
