/** Renderer input types and screen-space helpers (no JSX, so pure modules and tests can use them). */
import type { Vec3 } from './projection.js';

export interface SkyCanvasStar {
  readonly enu: Vec3;
  readonly magnitude: number;
  readonly colorIndexBV: number | null;
}

export interface SkyLine {
  readonly points: readonly Vec3[];
  readonly color: string;
  readonly width: number;
  readonly dash?: readonly number[];
  /** Pixels left empty at each end, so a figure line stops short of its stars. */
  readonly trim?: number;
  /**
   * Magnitudes of the two stars a line joins: each end then stops short by that star's
   * drawn radius plus a margin (overrides trim).
   */
  readonly endMagnitudes?: readonly [number, number];
}

/** The pixel size in a canvas font string such as "500 16px Tajawal" (14 if absent). */
export function fontPixels(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : 14;
}

/** Shortens a screen polyline by `start` and `end` pixels of path length. */
export function trimPolyline(
  points: readonly (readonly [number, number])[],
  start: number,
  end: number,
): [number, number][] {
  const length = (a: readonly [number, number], b: readonly [number, number]) =>
    Math.hypot(b[0] - a[0], b[1] - a[1]);
  const total = points.slice(1).reduce((sum, point, i) => sum + length(points[i]!, point), 0);
  // Short segments (a wide field of view) keep at least half their length.
  start = Math.min(start, total * 0.25);
  end = Math.min(end, total * 0.25);
  if (total <= 0) return [];
  const at = (distance: number): [number, number] => {
    let travelled = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const segment = length(a, b);
      if (travelled + segment >= distance) {
        const t = segment === 0 ? 0 : (distance - travelled) / segment;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      travelled += segment;
    }
    const last = points[points.length - 1]!;
    return [last[0], last[1]];
  };
  const result: [number, number][] = [at(start)];
  let travelled = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    travelled += length(points[i - 1]!, points[i]!);
    if (travelled > start && travelled < total - end) result.push([points[i]![0], points[i]![1]]);
  }
  result.push(at(total - end));
  return result;
}

export interface SkyLabel {
  /** Set when the label can be clicked (passed to onPickLabel). */
  readonly id?: string;
  readonly direction: Vec3;
  /** Further anchors, best first, tried when every place around `direction` is taken. */
  readonly alternatives?: readonly Vec3[];
  /** The label is first tried centred on `direction` (the middle of a figure). */
  readonly centred?: boolean;
  readonly text: string;
  readonly secondary?: string;
  readonly color: string;
  readonly font: string;
  /** Font of the secondary line (default: the UI font at 11 px). */
  readonly secondaryFont?: string;
  /** Lower is drawn first and wins collisions. */
  readonly priority: number;
  /** Shown only while the field of view is at most this (rad). */
  readonly maxFov?: number;
  /**
   * Vertical offset in CSS pixels (positive is upwards). A label with an offset that would
   * overlap a label already drawn moves to the mirror place on the other side of its
   * anchor, then beside it (right, then left), then the same places around each of its
   * alternatives; if every place is taken it is not drawn.
   */
  readonly offset?: number;
}
