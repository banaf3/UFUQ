/**
 * Turns a sky.v2 response into renderer inputs: stars, figure lines and labels, plus the
 * facts for the information card. Pure, so the label policy is unit-tested without a
 * browser. The explorer teaches the Arabic sky of the anwāʾ: Arabic names (with their
 * transliteration underneath) are the only names drawn on the sky.
 */
import type {
  SkyArabicNameV2,
  SkyEvidenceV2,
  SkyFigureV2,
  SkyModernNameV2,
  SkyViewV2,
} from '@ufuq/contracts';

import { greatCircle, meanDirection, type Vec3 } from '../sky/projection.js';
import type { SkyCanvasStar, SkyLabel, SkyLine } from '../sky/sky-types.js';

const DEG = Math.PI / 180;
const ARABIC_FONT = "'Noto Naskh Arabic', 'Segoe UI', 'Arial', system-ui, sans-serif";

export const FIGURE_LABEL_ID = 'figure:';
export const STAR_LABEL_ID = 'star:';

export function skyStars(sky: SkyViewV2): SkyCanvasStar[] {
  const { enu, visualMagnitudes, colorIndices, count } = sky.stars;
  return Array.from({ length: count }, (_, i) => ({
    enu: [enu[i * 3] as number, enu[i * 3 + 1] as number, enu[i * 3 + 2] as number] as const,
    magnitude: visualMagnitudes[i] as number,
    colorIndexBV: colorIndices[i] ?? null,
  }));
}

/**
 * Star-name labels appear as the view narrows: magnitude 1.5 and brighter at 120 degrees,
 * about 4 at 60 degrees and 6.5 at 30 degrees (one magnitude per 2.5 doubling steps).
 */
export function nameFovLimit(visualMagnitude: number): number {
  if (visualMagnitude <= 1.5) return 360 * DEG;
  return 120 * DEG * 2 ** ((1.5 - visualMagnitude) / 2.5);
}

/** Smaller figures inside a larger one (a mansion inside the lion) are named when zoomed in. */
export const CHILD_FIGURE_MAX_FOV = 100 * DEG;

export interface SkyLayerOptions {
  readonly showLines: boolean;
  readonly showNames: boolean;
  readonly selectedFigureId?: string | null;
}

type LineStyle = 'SELECTED' | 'FIGURE' | 'GROUP';
const LINE_RANK: Record<LineStyle, number> = { SELECTED: 0, FIGURE: 1, GROUP: 2 };
const LINE_LOOK: Record<LineStyle, Omit<SkyLine, 'points'>> = {
  SELECTED: { color: 'rgba(255, 226, 160, 0.98)', width: 2.6, trim: 6 },
  FIGURE: { color: 'rgba(232, 180, 79, 0.85)', width: 1.6, trim: 6 },
  GROUP: { color: 'rgba(232, 180, 79, 0.45)', width: 1.1, trim: 6, dash: [3, 4] },
};

/** The figure, its ancestors and its descendants: the lines drawn as selected. */
function selectedFamily(figures: readonly SkyFigureV2[], id: string | null | undefined) {
  const family = new Set<string>();
  if (!id) return family;
  family.add(id);
  let grew = true;
  while (grew) {
    grew = false;
    for (const figure of figures)
      if (figure.parentId && family.has(figure.parentId) && !family.has(figure.figureId)) {
        family.add(figure.figureId);
        grew = true;
      }
  }
  return family;
}

export function skyLayers(
  sky: SkyViewV2,
  stars: readonly SkyCanvasStar[],
  options: SkyLayerOptions,
): { lines: SkyLine[]; labels: SkyLabel[] } {
  const lines: SkyLine[] = [];
  const labels: SkyLabel[] = [];
  const figures = sky.culture?.figures ?? [];
  if (options.showLines) {
    // A segment shared by a figure and the larger figure around it is drawn once.
    const family = selectedFamily(figures, options.selectedFigureId);
    const segments = new Map<string, { a: number; b: number; style: LineStyle }>();
    for (const figure of figures) {
      const style: LineStyle = family.has(figure.figureId) ? 'SELECTED' : figure.style;
      for (const [a, b] of figure.segments) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        const existing = segments.get(key);
        if (!existing || LINE_RANK[style] < LINE_RANK[existing.style])
          segments.set(key, { a, b, style });
      }
    }
    for (const { a, b, style } of segments.values()) {
      const from = stars[a]?.enu;
      const to = stars[b]?.enu;
      if (from && to) lines.push({ points: greatCircle(from, to), ...LINE_LOOK[style] });
    }
  }
  if (!options.showNames) return { lines, labels };
  for (const figure of figures) {
    const anchor = meanDirection(
      figure.memberIndices
        .map((index) => stars[index]?.enu)
        .filter((direction): direction is Vec3 => direction !== undefined),
    );
    if (!anchor) continue;
    const child = figure.parentId !== null;
    const selected = figure.figureId === options.selectedFigureId;
    labels.push({
      id: `${FIGURE_LABEL_ID}${figure.figureId}`,
      direction: anchor,
      text: figure.arabic,
      secondary: figure.transliteration,
      color: selected ? '#ffe2a0' : child ? 'rgba(242, 200, 106, 0.88)' : '#f2c86a',
      font: `${child ? '500 14px' : '600 17px'} ${ARABIC_FONT}`,
      priority: selected ? -1 : child ? 1 : figure.style === 'GROUP' ? 0.5 : 0,
      ...(child && !selected ? { maxFov: CHILD_FIGURE_MAX_FOV } : {}),
      offset: 22,
    });
  }
  for (const name of sky.arabicNames) {
    const star = stars[name.starIndex];
    if (!star || !name.labelOnSky) continue;
    labels.push({
      id: `${STAR_LABEL_ID}${name.starIndex}`,
      direction: star.enu,
      text: name.arabic,
      secondary: name.transliteration,
      color: 'rgba(236, 241, 248, 0.9)',
      font: `500 14px ${ARABIC_FONT}`,
      priority: 2 + star.magnitude / 10,
      maxFov: nameFovLimit(star.magnitude),
      offset: -14,
    });
  }
  return { lines, labels };
}

export const EVIDENCE_TEXT: Readonly<Record<SkyEvidenceV2, string>> = {
  PRIMARY_TEXT_READ: 'Read in the primary anwāʾ texts (see the sources).',
  PRIMARY_TEXT_POINTER: 'Found in the primary anwāʾ texts by search; the passage is not yet read.',
  COLLECTIVE_NAME_IN_PRIMARY_TEXT:
    'The primary texts name this group; the exact name or division shown is the compilation’s.',
  NAMED_WITH_FIGURE: 'Named after its figure, which the primary texts describe.',
  COMPILATION_ONLY: 'Listed by the compilation; not yet located in the owner’s primary texts.',
};

export interface StarDetails {
  readonly id: string;
  readonly hip: string | null;
  readonly arabic: SkyArabicNameV2 | null;
  readonly modern: SkyModernNameV2 | null;
  /** Figures the star belongs to, smallest first. */
  readonly figures: readonly SkyFigureV2[];
  readonly magnitude: number | null;
  readonly colorIndex: number | null;
  readonly enu: [number, number, number];
}

/** Facts for the star information card. */
export function starDetails(sky: SkyViewV2, index: number): StarDetails {
  const id = sky.stars.ids[index] ?? '';
  const figures = (sky.culture?.figures ?? [])
    .filter((figure) => figure.memberIndices.includes(index))
    .sort((a, b) => a.memberIndices.length - b.memberIndices.length);
  return {
    id,
    hip: /^hip-(\d+)$/.exec(id)?.[1] ?? null,
    arabic: sky.arabicNames.find((name) => name.starIndex === index) ?? null,
    modern: sky.modernNames.find((name) => name.starIndex === index) ?? null,
    figures,
    magnitude: sky.stars.visualMagnitudes[index] ?? null,
    colorIndex: sky.stars.colorIndices[index] ?? null,
    enu: [
      sky.stars.enu[index * 3] as number,
      sky.stars.enu[index * 3 + 1] as number,
      sky.stars.enu[index * 3 + 2] as number,
    ],
  };
}

export interface FigureDetails {
  readonly figure: SkyFigureV2;
  readonly parent: SkyFigureV2 | null;
  readonly children: readonly SkyFigureV2[];
  /** Member stars with their Arabic names where the tradition gives one. */
  readonly members: readonly { readonly index: number; readonly name: SkyArabicNameV2 | null }[];
}

/** Facts for the figure information card. */
export function figureDetails(sky: SkyViewV2, figureId: string): FigureDetails | null {
  const figures = sky.culture?.figures ?? [];
  const figure = figures.find((f) => f.figureId === figureId);
  if (!figure) return null;
  return {
    figure,
    parent: figures.find((f) => f.figureId === figure.parentId) ?? null,
    children: figures.filter((f) => f.parentId === figure.figureId),
    members: figure.memberIndices
      .map((index) => ({
        index,
        name: sky.arabicNames.find((name) => name.starIndex === index) ?? null,
      }))
      .sort(
        (a, b) =>
          (sky.stars.visualMagnitudes[a.index] ?? 9) - (sky.stars.visualMagnitudes[b.index] ?? 9),
      ),
  };
}

export interface FindOption {
  readonly label: string;
  readonly indices: readonly number[];
  readonly figureId?: string;
}

/** Search by Arabic script, transliteration or (for a star) its modern name. */
export function findOptions(sky: SkyViewV2): FindOption[] {
  const options: FindOption[] = [];
  for (const figure of sky.culture?.figures ?? []) {
    const entry = { indices: figure.memberIndices, figureId: figure.figureId };
    options.push({ label: `${figure.transliteration} — ${figure.arabic}`, ...entry });
  }
  for (const name of sky.arabicNames)
    options.push({ label: `${name.transliteration} — ${name.arabic}`, indices: [name.starIndex] });
  for (const name of sky.modernNames)
    options.push({ label: `${name.name} (modern name)`, indices: [name.starIndex] });
  const seen = new Set<string>();
  return options
    .filter((option) => !seen.has(option.label) && seen.add(option.label))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Matches typed text against the options: exact label, then any name part. */
export function matchFind(options: readonly FindOption[], text: string): FindOption | null {
  const query = text.trim().toLowerCase();
  if (!query) return null;
  return (
    options.find((option) => option.label.toLowerCase() === query) ??
    options.find((option) =>
      option.label
        .toLowerCase()
        .split(' — ')
        .some((part) => part.replace(' (modern name)', '') === query),
    ) ??
    null
  );
}
