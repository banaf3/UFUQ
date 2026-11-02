/**
 * Scene adapter (IMP-010, ADR-003): domain ENU maps to Three.js +X east, +Y up, -Z north.
 * The adapter only places already computed geometric directions; it never computes
 * astronomy, applies refraction, or decides visibility, eligibility or correctness.
 */

export type Vector3Tuple = readonly [number, number, number];

export const SKY_RADIUS = 100;

/** ENU unit vector to a Three.js position on the sky sphere. */
export function enuToScene(enu: Vector3Tuple, radius = SKY_RADIUS): Vector3Tuple {
  const [east, north, up] = enu;
  return [east * radius, up * radius, -north * radius];
}

/** View direction (Three.js) for a north-zero, east-positive heading and a pitch (rad). */
export function viewDirection(headingRadians: number, pitchRadians: number): Vector3Tuple {
  const cosPitch = Math.cos(pitchRadians);
  return [
    Math.sin(headingRadians) * cosPitch,
    Math.sin(pitchRadians),
    -Math.cos(headingRadians) * cosPitch,
  ];
}

/** Normalizes a heading to [0, 2pi). */
export function normalizeHeading(headingRadians: number): number {
  const full = 2 * Math.PI;
  const value = headingRadians % full;
  return value < 0 ? value + full : value;
}

/** Display-only altitude/azimuth (degrees) of an ENU vector for labels and lists. */
export function describeEnu(enu: Vector3Tuple): {
  altitudeDegrees: number;
  azimuthDegrees: number | null;
} {
  const [east, north, up] = enu;
  const horizontal = Math.hypot(east, north);
  const altitudeDegrees = (Math.atan2(up, horizontal) * 180) / Math.PI;
  const azimuthDegrees =
    horizontal === 0 ? null : ((((Math.atan2(east, north) * 180) / Math.PI) % 360) + 360) % 360;
  return { altitudeDegrees, azimuthDegrees };
}

/** Points along the great circle from a to b (inclusive), for guide arcs. */
export function greatCirclePoints(a: Vector3Tuple, b: Vector3Tuple, segments = 48): Vector3Tuple[] {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega === 0) return [a, b];
  const sinOmega = Math.sin(omega);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const wa = Math.sin((1 - t) * omega) / sinOmega;
    const wb = Math.sin(t * omega) / sinOmega;
    return [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]] as const;
  });
}

/** The geometric-horizon point directly below an ENU direction (same azimuth, altitude 0). */
export function horizonPointBelow(enu: Vector3Tuple): Vector3Tuple {
  const [east, north] = enu;
  const horizontal = Math.hypot(east, north);
  return horizontal === 0 ? [0, 1, 0] : [east / horizontal, north / horizontal, 0];
}

/** Display size of a star from its catalogue V magnitude (presentation only). */
export function starRadius(visualMagnitude: number | null): number {
  const magnitude = visualMagnitude ?? 3;
  return Math.max(0.35, 1.25 - 0.22 * magnitude);
}
