/**
 * The compass ring: a circle drawn on the horizon around the observer, in the sky's own 3D
 * projection, with degree ticks counted clockwise from True North (0 = 360), a marker for
 * the bearing the learner faces, and the Qibla when the place has one. It teaches the
 * turn from north to the Qibla and, once north is found, where east, south and west are.
 */
import { NAME_FONT } from '../explorer/sky-layers.js';
import { directionFromAltAz, type Vec3 } from '../sky/projection.js';
import type { SkyLabel, SkyLine } from '../sky/sky-types.js';

const DEG = Math.PI / 180;
const RING_ALTITUDE = 0.3 * DEG;
const MINOR_TICK_TOP = 2.2 * DEG;
const MAJOR_TICK_TOP = 4.2 * DEG;
const NUMBER_ALTITUDE = 6.2 * DEG;
const MARKER_TOP = 5 * DEG;
const MARKER_LABEL_ALTITUDE = 8.4 * DEG;

export const RING_COLOURS = {
  ring: 'rgba(159, 216, 196, 0.75)',
  tick: 'rgba(159, 216, 196, 0.9)',
  number: 'rgba(200, 236, 222, 0.95)',
  heading: '#7fe3ff',
  qibla: '#ffd9a6',
} as const;

export interface CompassRingOptions {
  /** The bearing the learner faces (the view centre), or null for no marker. */
  readonly headingAzimuth: number | null;
  /** The Qibla bearing to mark, or null. */
  readonly qiblaAzimuth: number | null;
  /** Degree numbers and the "You face N°" text; off in assessments (ticks and marker only). */
  readonly numbered: boolean;
}

const tick = (azimuth: number, top: number): Vec3[] => [
  directionFromAltAz(RING_ALTITUDE, azimuth),
  directionFromAltAz(top, azimuth),
];

const degreesText = (azimuth: number) =>
  `${Math.round((((azimuth / DEG) % 360) + 360) % 360) % 360}°`;

export function compassRingLayers(options: CompassRingOptions): {
  lines: SkyLine[];
  labels: SkyLabel[];
} {
  const lines: SkyLine[] = [];
  const labels: SkyLabel[] = [];
  // The ring itself, all the way round (the part behind the viewer is simply out of view).
  const ring: Vec3[] = [];
  for (let degrees = 0; degrees <= 360; degrees += 2)
    ring.push(directionFromAltAz(RING_ALTITUDE, degrees * DEG));
  lines.push({ points: ring, color: RING_COLOURS.ring, width: 2 });
  for (let degrees = 0; degrees < 360; degrees += 10) {
    const major = degrees % 30 === 0;
    lines.push({
      points: tick(degrees * DEG, major ? MAJOR_TICK_TOP : MINOR_TICK_TOP),
      color: RING_COLOURS.tick,
      width: major ? 2 : 1.2,
    });
    if (major && options.numbered)
      labels.push({
        direction: directionFromAltAz(NUMBER_ALTITUDE, degrees * DEG),
        text: `${degrees}`,
        color: RING_COLOURS.number,
        font: `600 13px ${NAME_FONT}`,
        priority: 3,
        offset: 0,
      });
  }
  if (options.qiblaAzimuth !== null) {
    lines.push({
      points: tick(options.qiblaAzimuth, MARKER_TOP),
      color: RING_COLOURS.qibla,
      width: 3,
    });
    labels.push({
      direction: directionFromAltAz(MARKER_LABEL_ALTITUDE, options.qiblaAzimuth),
      text: 'القبلة',
      secondary: `Qibla ${degreesText(options.qiblaAzimuth)}`,
      color: RING_COLOURS.qibla,
      font: `700 15px ${NAME_FONT}`,
      secondaryFont: `500 12px ${NAME_FONT}`,
      priority: -1,
      offset: 0,
    });
  }
  if (options.headingAzimuth !== null) {
    lines.push({
      points: tick(options.headingAzimuth, MARKER_TOP),
      color: RING_COLOURS.heading,
      width: 3,
    });
    if (options.numbered)
      labels.push({
        direction: directionFromAltAz(MARKER_LABEL_ALTITUDE, options.headingAzimuth),
        text: `You face ${degreesText(options.headingAzimuth)}`,
        color: RING_COLOURS.heading,
        font: `600 12px ${NAME_FONT}`,
        priority: -2,
        offset: 0,
      });
  }
  return { lines, labels };
}
