/** Angle helpers. Internal arithmetic uses radians; public values use named degrees. */

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function degToRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

export function radToDeg(rad: number): number {
  return rad * RAD_TO_DEG;
}

/**
 * Wrap to `[0, 360)`. PROVISIONAL representative (Phase 1 spike): the final
 * wrap-boundary representative is an AST-003/007 decision.
 */
export function normalizeDegrees360(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  // A tiny negative input can round up to exactly 360; fold it and drop negative zero.
  return wrapped >= 360 || wrapped === 0 ? 0 : wrapped;
}

/**
 * Wrap to `[-180, 180)`. PROVISIONAL representative (Phase 1 spike), see above.
 */
export function normalizeDegreesSigned(deg: number): number {
  const wrapped = normalizeDegrees360(deg + 180) - 180;
  return wrapped === 0 ? 0 : wrapped;
}

export function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}
