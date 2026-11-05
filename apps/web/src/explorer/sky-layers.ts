/**
 * Turns a sky.v2 response into renderer inputs: stars, figure lines and labels, plus the
 * facts for the information card. Pure, so the label policy is unit-tested without a
 * browser. The explorer teaches the Arabic sky of the anwāʾ: Arabic names (with their
 * plain-letter transliteration underneath) are the only names drawn on the sky.
 *
 * Look (IMP-022): blue lines and blue figure names, after Stellarium's default
 * constellation colours (lines 0.2, 0.2, 0.6; names 0.4, 0.6, 0.9 in default_cfg.ini),
 * lines kept fainter than the stars; star names are grey (owner's choice). Each line stops
 * short of its two stars by the star's drawn radius plus a small margin, as Stellarium Web
 * Engine does (radius + 0.2 degrees), so the lines never cover the stars they join.
 * Arabic and transliteration share one font and one weight.
 * A figure's name sits on its own lines (figurePlacement). A figure inside a larger one is
 * named at the star-name size, in a slightly darker blue than the whole figures.
 */
import type { SkyArabicNameV2, SkyFigureV2, SkyModernNameV2, SkyViewV2 } from '@ufuq/contracts';

import { greatCircle, meanDirection, type Vec3 } from '../sky/projection.js';
import type { SkyCanvasStar, SkyLabel, SkyLine } from '../sky/sky-types.js';

const DEG = Math.PI / 180;
/** Tajawal (SIL OFL 1.1, bundled from @fontsource/tajawal) for Arabic and its transliteration. */
export const NAME_FONT = "'Tajawal', 'Segoe UI', 'Arial', system-ui, sans-serif";
/** One weight for every name, Arabic and Latin alike (neither is bold). */
const NAME_WEIGHT = 500;
const FIGURE_NAME = 'rgb(159 194 241)';
/** A figure inside a larger one: the figure blue, a little darker (0.85 of each channel). */
const CHILD_FIGURE_NAME = 'rgb(135 165 205)';
const SELECTED_NAME = 'rgb(176, 208, 255)';
const STAR_NAME = 'rgb(168, 167, 165)';
/** Font sizes (CSS px) of the Arabic name and of the transliteration under it. */
const FIGURE_NAME_SIZE = { arabic: 16, latin: 16 } as const;
/** Star names, and the figures inside a larger figure, which share their size. */
const SMALL_NAME_SIZE = { arabic: 12, latin: 13 } as const;

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
const LINE_LOOK: Record<LineStyle, Omit<SkyLine, 'points' | 'endMagnitudes'>> = {
  SELECTED: { color: 'rgba(140, 182, 255, 0.85)', width: 1.8 },
  FIGURE: { color: 'rgba(78, 116, 196, 0.6)', width: 1.1 },
  GROUP: { color: 'rgba(78, 116, 196, 0.4)', width: 1, dash: [3, 4] },
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

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** The point of the great-circle arc a–b nearest to c (all unit vectors). */
export function nearestOnArc(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const nearer = dot(a, c) >= dot(b, c) ? a : b;
  const normal = cross(a, b);
  const length = Math.hypot(...normal);
  if (length < 1e-9) return nearer;
  const n: Vec3 = [normal[0] / length, normal[1] / length, normal[2] / length];
  const h = dot(c, n);
  const p: Vec3 = [c[0] - h * n[0], c[1] - h * n[1], c[2] - h * n[2]];
  const pLength = Math.hypot(...p);
  if (pLength < 1e-9) return nearer;
  const q: Vec3 = [p[0] / pLength, p[1] / pLength, p[2] / pLength];
  // q lies on the arc when it is between a and b, turning the same way as a to b.
  return dot(cross(a, q), n) >= 0 && dot(cross(q, b), n) >= 0 ? q : nearer;
}

/** At most this many places along a figure are offered for its name. */
const MAX_NAME_ANCHORS = 8;
/** Places along a figure closer than this (about half a degree) count as one. */
const SAME_PLACE = Math.cos(0.5 * DEG);

export interface FigurePlacement {
  /** Where the name may sit, best first; the first is the figure's point nearest its centre. */
  readonly anchors: readonly Vec3[];
  /** The largest angle (rad) from the centre of the stars to a member star. */
  readonly spread: number;
}

/**
 * Where a figure's name may sit: points of the figure itself, nearest to the centre of its
 * stars first. They are on the figure's drawn lines (one per line, its point nearest that
 * centre), or for a figure without lines its member stars. A spread or curved figure
 * (al-Thurayya al-Sura, al-Asad) has its centre in empty sky, often beside another figure,
 * so its name stays on its own lines; if the best place is taken it moves along them.
 */
export function figurePlacement(
  figure: SkyFigureV2,
  stars: readonly SkyCanvasStar[],
): FigurePlacement | null {
  const members = figure.memberIndices
    .map((index) => stars[index]?.enu)
    .filter((direction): direction is Vec3 => direction !== undefined);
  const centre = meanDirection(members);
  if (!centre) return null;
  const onLines: Vec3[] = [];
  for (const [a, b] of figure.segments) {
    const from = stars[a]?.enu;
    const to = stars[b]?.enu;
    if (from && to) onLines.push(nearestOnArc(from, to, centre));
  }
  const anchors: Vec3[] = [];
  for (const point of [...(onLines.length > 0 ? onLines : members)].sort(
    (p, q) => dot(q, centre) - dot(p, centre),
  ))
    if (anchors.length < MAX_NAME_ANCHORS && anchors.every((a) => dot(a, point) < SAME_PLACE))
      anchors.push(point);
  const spread = Math.acos(Math.min(1, Math.min(...members.map((m) => dot(m, centre)))));
  return { anchors, spread };
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
      const from = stars[a];
      const to = stars[b];
      if (from && to)
        lines.push({
          points: greatCircle(from.enu, to.enu),
          endMagnitudes: [from.magnitude, to.magnitude],
          ...LINE_LOOK[style],
        });
    }
  }
  if (!options.showNames) return { lines, labels };
  for (const figure of figures) {
    const placement = figurePlacement(figure, stars);
    const [anchor, ...alternatives] = placement?.anchors ?? [];
    if (!placement || !anchor) continue;
    const child = figure.parentId !== null;
    const selected = figure.figureId === options.selectedFigureId;
    const size = child ? SMALL_NAME_SIZE : FIGURE_NAME_SIZE;
    // Lower wins a collision: the selection, then whole figures, groups, then inner
    // figures. Within each, compact figures (al-Thurayya, al-Haq'a) come first: their name
    // has one natural place, while a spread figure can move along its own lines.
    const rank = selected ? -1 : child ? 1 : figure.style === 'GROUP' ? 0.5 : 0;
    labels.push({
      id: `${FIGURE_LABEL_ID}${figure.figureId}`,
      direction: anchor,
      alternatives,
      text: figure.arabic,
      secondary: figure.transliteration,
      color: selected ? SELECTED_NAME : child ? CHILD_FIGURE_NAME : FIGURE_NAME,
      font: `${NAME_WEIGHT} ${size.arabic}px ${NAME_FONT}`,
      secondaryFont: `${NAME_WEIGHT} ${size.latin}px ${NAME_FONT}`,
      priority: rank + placement.spread / Math.PI / 10,
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
      color: STAR_NAME,
      font: `${NAME_WEIGHT} ${SMALL_NAME_SIZE.arabic}px ${NAME_FONT}`,
      secondaryFont: `${NAME_WEIGHT} ${SMALL_NAME_SIZE.latin}px ${NAME_FONT}`,
      priority: 2 + star.magnitude / 10,
      maxFov: nameFovLimit(star.magnitude),
      offset: -14,
    });
  }
  return { lines, labels };
}

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

/**
 * Folds a name for search: case, Latin diacritics, ʿ ʾ and apostrophes, Arabic vowel marks
 * and letter forms; hyphens count as spaces, and a loose fold drops word breaks too.
 */
export function foldName(text: string, loose = false): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '') // Latin diacritics and Arabic vowel marks (NFD splits آ أ إ)
    .toLowerCase()
    .replace(/[ʿʾ'’ـ]/g, '')
    .replace(/[\s-]+/g, loose ? '' : ' ')
    .trim()
    .replace(/ٱ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

/**
 * Matches typed text against the options: the whole label, then any name part, first
 * with word breaks kept ("al qalb" = "Al-Qalb"), then without them ("alziba" = "Al-Ziba").
 */
export function matchFind(options: readonly FindOption[], text: string): FindOption | null {
  const parts = (option: FindOption) =>
    option.label.split(' — ').map((part) => part.replace(' (modern name)', ''));
  for (const loose of [false, true]) {
    const query = foldName(text, loose);
    if (!query) return null;
    const found =
      options.find((option) => foldName(option.label, loose) === query) ??
      options.find((option) => parts(option).some((part) => foldName(part, loose) === query));
    if (found) return found;
  }
  return null;
}
