/**
 * Server-issued overlays as renderer lines and labels, shared by the lesson and the
 * walkthrough. Only what the server issued is drawn: figure lines without names while
 * support fades (report storyboard figure 3-6), names and guides when guided.
 */
import type { SkyOverlayV2 } from '@ufuq/contracts';

import { NAME_FONT } from '../explorer/sky-layers.js';
import { horizonPointBelow } from '../scene/mapping.js';
import { directionFromAltAz, greatCircle, meanDirection, type Vec3 } from '../sky/projection.js';
import type { SkyLabel, SkyLine } from '../sky/sky-types.js';

const DEG = Math.PI / 180;

/** Colours of the explorer, so a lesson looks like the sky the learner explored. */
export const LESSON_COLOURS = {
  figureLine: 'rgba(78, 116, 196, 0.6)',
  focusLine: 'rgba(140, 182, 255, 0.95)',
  pastLine: 'rgba(110, 150, 220, 0.55)',
  figureName: 'rgb(159 194 241)',
  childName: 'rgb(135 165 205)',
  starName: 'rgb(168, 167, 165)',
  outline: 'rgba(232, 180, 79, 0.95)',
  guide: 'rgba(127, 227, 255, 0.95)',
  vertical: 'rgba(166, 247, 200, 0.95)',
  qibla: 'rgba(255, 196, 120, 0.95)',
} as const;

export interface LayerOptions {
  /** Draw progressively from this performance.now() time (walkthrough tracing). */
  readonly drawFrom?: number;
  readonly drawMs?: number;
  /** Earlier walkthrough frames stay on the sky, dimmer. */
  readonly past?: boolean;
}

const font = (weight: number, size: number) => `${weight} ${size}px ${NAME_FONT}`;

/**
 * Points along the horizon between two azimuths (rad), the short way round: the Qibla at
 * Pekan (about 292 degrees) is drawn as the turn of about 68 degrees west from north.
 */
function horizonArc(start: number, end: number): Vec3[] {
  const clockwise = (((end - start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const [from, span] = clockwise <= Math.PI ? [start, clockwise] : [end, 2 * Math.PI - clockwise];
  const steps = Math.max(2, Math.ceil(span / (1.5 * DEG)));
  return Array.from({ length: steps + 1 }, (_, i) =>
    directionFromAltAz(0.002, from + (span * i) / steps),
  );
}

export function overlayLayers(
  overlays: readonly SkyOverlayV2[],
  enuOf: (handle: string) => Vec3 | undefined,
  options: LayerOptions = {},
): { lines: SkyLine[]; labels: SkyLabel[] } {
  const lines: SkyLine[] = [];
  const labels: SkyLabel[] = [];
  const timing =
    options.drawFrom === undefined
      ? {}
      : { drawFrom: options.drawFrom, drawMs: options.drawMs ?? 1200 };
  const line = (points: Vec3[], style: Omit<SkyLine, 'points'>) =>
    lines.push({ ...style, ...timing, points });
  const arc = (from: Vec3 | undefined, to: Vec3 | undefined, style: Omit<SkyLine, 'points'>) => {
    if (from && to) line(greatCircle(from, to), style);
  };
  const past = options.past === true;
  for (const overlay of overlays) {
    if (overlay.kind === 'FIGURE_LINES') {
      for (const [a, b] of overlay.segments)
        arc(enuOf(a), enuOf(b), {
          color: past ? LESSON_COLOURS.pastLine : LESSON_COLOURS.figureLine,
          width: 1.1,
          trim: 6,
        });
    } else if (overlay.kind === 'FIGURE_NAMES') {
      for (const figure of overlay.figures) {
        const anchor = meanDirection(
          figure.memberHandles.map(enuOf).filter((d): d is Vec3 => d !== undefined),
        );
        if (!anchor) continue;
        labels.push({
          direction: anchor,
          centred: true,
          text: figure.arabic,
          secondary: figure.transliteration,
          color: figure.child ? LESSON_COLOURS.childName : LESSON_COLOURS.figureName,
          font: font(500, figure.child ? 12 : 16),
          secondaryFont: font(500, figure.child ? 13 : 16),
          priority: figure.child ? 1 : 0,
          offset: 22,
        });
      }
      for (const star of overlay.stars) {
        const direction = enuOf(star.handle);
        if (!direction) continue;
        const weight = star.guidanceTarget ? 700 : 500;
        labels.push({
          direction,
          text: star.arabic,
          secondary: star.transliteration,
          color: LESSON_COLOURS.starName,
          font: font(weight, 12),
          secondaryFont: font(weight, 13),
          priority: star.guidanceTarget ? -0.5 : 2,
          offset: -16,
        });
      }
    } else if (overlay.kind === 'PATTERN_OUTLINE') {
      for (const [a, b] of overlay.segments)
        arc(enuOf(a), enuOf(b), { color: LESSON_COLOURS.outline, width: 1.8, trim: 6 });
      const anchor = meanDirection(
        overlay.memberHandles.map(enuOf).filter((d): d is Vec3 => d !== undefined),
      );
      const label = overlay.labels.find((l) => l.script !== null) ?? overlay.labels[0];
      if (anchor && label) {
        labels.push({
          direction: anchor,
          text: label.script ?? label.transliteration ?? '',
          ...(label.script && label.transliteration ? { secondary: label.transliteration } : {}),
          color: '#f2c86a',
          font: font(500, 16),
          secondaryFont: font(500, 13),
          priority: -1,
          offset: 26,
        });
      }
    } else if (overlay.kind === 'GUIDE_ARC') {
      for (let i = 1; i < overlay.handles.length; i += 1)
        arc(enuOf(overlay.handles[i - 1] as string), enuOf(overlay.handles[i] as string), {
          color: LESSON_COLOURS.guide,
          width: 1.8,
          dash: [8, 6],
        });
    } else if (overlay.kind === 'GUIDE_ARC_PARTIAL') {
      arc(enuOf(overlay.fromHandle), overlay.endEnu, {
        color: LESSON_COLOURS.guide,
        width: 1.8,
        dash: [8, 6],
      });
    } else if (overlay.kind === 'VERTICAL_TO_HORIZON') {
      const from = enuOf(overlay.fromHandle);
      if (from)
        arc(from, horizonPointBelow(from), {
          color: LESSON_COLOURS.vertical,
          width: 1.8,
          dash: [6, 6],
        });
    } else if (overlay.kind === 'HORIZON_ARC') {
      line(horizonArc(overlay.fromAzimuthRadians, overlay.toAzimuthRadians), {
        color: LESSON_COLOURS.qibla,
        width: 2.2,
      });
      labels.push({
        direction: directionFromAltAz(3 * DEG, overlay.toAzimuthRadians),
        text: 'القبلة',
        secondary: overlay.label,
        color: '#ffd9a6',
        font: font(700, 16),
        secondaryFont: font(500, 13),
        priority: -1,
        offset: 20,
      });
    } else if (overlay.kind === 'STAR_LABEL') {
      const direction = enuOf(overlay.handle);
      const label = overlay.labels.find((l) => l.script) ?? overlay.labels[0];
      if (direction && label) {
        labels.push({
          direction,
          text: label.script ?? label.transliteration ?? '',
          ...(label.script && label.transliteration ? { secondary: label.transliteration } : {}),
          color: '#f6e7b4',
          font: font(500, 15),
          secondaryFont: font(500, 12),
          priority: 0,
          offset: 22,
        });
      }
    }
  }
  return { lines, labels };
}

/** The guide and history texts of the issued overlays, for the side panel. */
export function guideTexts(overlays: readonly SkyOverlayV2[]): { key: string; text: string }[] {
  return overlays.flatMap((overlay) => {
    if (
      overlay.kind === 'GUIDE_ARC' ||
      overlay.kind === 'GUIDE_ARC_PARTIAL' ||
      overlay.kind === 'HORIZON_ARC'
    )
      return [{ key: overlay.relationshipId, text: overlay.explanation }];
    if (overlay.kind === 'VERTICAL_TO_HORIZON') {
      const history = overlay.historicalContext ? ` History: ${overlay.historicalContext}` : '';
      return [{ key: overlay.relationshipId, text: `${overlay.explanation}${history}` }];
    }
    return [];
  });
}
