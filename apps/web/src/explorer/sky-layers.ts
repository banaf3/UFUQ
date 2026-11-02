/**
 * Turns a sky.v1 response into renderer inputs: stars, figure lines and labels. Pure, so
 * the culture filters and label policy are unit-tested without a browser.
 */
import type { SkyViewV1 } from '@ufuq/contracts';

import { greatCircle, meanDirection, type Vec3 } from '../sky/projection.js';
import type { SkyCanvasStar, SkyLabel, SkyLine } from '../sky/sky-types.js';

export type CultureMode = 'ARABIC_AND_IAU' | 'ARABIC' | 'IAU';

export const CULTURE_MODES: readonly { readonly id: CultureMode; readonly label: string }[] = [
  { id: 'ARABIC_AND_IAU', label: 'Arabic patterns + IAU constellations' },
  { id: 'ARABIC', label: 'Arabic patterns (UFUQ curated)' },
  { id: 'IAU', label: 'IAU constellations' },
];

const DEG = Math.PI / 180;
const ARABIC_CULTURE = 'arabic-ufuq';

export function skyStars(sky: SkyViewV1): SkyCanvasStar[] {
  const { enu, visualMagnitudes, colorIndices, count } = sky.stars;
  return Array.from({ length: count }, (_, i) => ({
    enu: [enu[i * 3] as number, enu[i * 3 + 1] as number, enu[i * 3 + 2] as number] as const,
    magnitude: visualMagnitudes[i] as number,
    colorIndexBV: colorIndices[i] ?? null,
  }));
}

function cultureVisible(cultureId: string, mode: CultureMode): boolean {
  if (cultureId === ARABIC_CULTURE) return mode !== 'IAU';
  return mode !== 'ARABIC';
}

/**
 * Star-name labels appear as the view narrows: magnitude 1.5 and brighter at 120 degrees,
 * about 4 at 60 degrees and 6.5 at 30 degrees (one magnitude per 2.5 doubling steps).
 */
export function nameFovLimit(visualMagnitude: number): number {
  if (visualMagnitude <= 1.5) return 360 * DEG;
  return 120 * DEG * 2 ** ((1.5 - visualMagnitude) / 2.5);
}

export interface SkyLayerOptions {
  readonly mode: CultureMode;
  readonly showLines: boolean;
  readonly showNames: boolean;
}

export function skyLayers(
  sky: SkyViewV1,
  stars: readonly SkyCanvasStar[],
  options: SkyLayerOptions,
): { lines: SkyLine[]; labels: SkyLabel[] } {
  const lines: SkyLine[] = [];
  const labels: SkyLabel[] = [];
  for (const culture of sky.cultures) {
    if (!cultureVisible(culture.cultureId, options.mode)) continue;
    const arabic = culture.cultureId === ARABIC_CULTURE;
    for (const figure of culture.figures) {
      if (options.showLines) {
        for (const [a, b] of figure.segments) {
          const from = stars[a]?.enu;
          const to = stars[b]?.enu;
          if (!from || !to) continue;
          lines.push({
            points: greatCircle(from, to),
            color: arabic ? 'rgba(232, 180, 79, 0.9)' : 'rgba(120, 160, 210, 0.55)',
            width: arabic ? 1.8 : 1,
            trim: 6,
          });
        }
      }
      if (!options.showNames) continue;
      const anchor = meanDirection(
        figure.memberIndices
          .map((index) => stars[index]?.enu)
          .filter((d): d is Vec3 => d !== undefined),
      );
      if (!anchor) continue;
      if (arabic) {
        const script = figure.labels.find(
          (label) => label.script && label.languageTag === 'ar',
        )?.script;
        labels.push({
          direction: anchor,
          text: script ?? figure.name,
          ...(script ? { secondary: figure.name } : {}),
          color: '#f2c86a',
          font: "600 16px 'Noto Naskh Arabic', 'Segoe UI', system-ui, sans-serif",
          priority: 0,
          offset: 22,
        });
      } else {
        labels.push({
          direction: anchor,
          text: figure.name.toUpperCase(),
          color: 'rgba(150, 185, 230, 0.75)',
          font: '500 11px Inter, ui-sans-serif, system-ui, sans-serif',
          priority: 2,
        });
      }
    }
  }
  if (options.showNames) {
    for (const name of sky.starNames) {
      const star = stars[name.starIndex];
      if (!star || !starNameShown(name.language, star.magnitude, options.mode)) continue;
      labels.push({
        direction: star.enu,
        text: name.name,
        ...(name.arabicScript ? { secondary: name.arabicScript } : {}),
        color: 'rgba(236, 241, 248, 0.85)',
        font: '12px Inter, ui-sans-serif, system-ui, sans-serif',
        priority: 1 + star.magnitude / 10,
        maxFov: nameFovLimit(star.magnitude),
        offset: -14,
      });
    }
  }
  return { lines, labels };
}

/**
 * Which IAU star names a culture view shows: Arabic-origin names (WGSN language "Arabic")
 * in the Arabic views, plus the very brightest stars in the combined view; every name in
 * the IAU view.
 */
export function starNameShown(
  language: string,
  visualMagnitude: number,
  mode: CultureMode,
): boolean {
  if (mode === 'IAU') return true;
  if (language === 'Arabic') return true;
  return mode === 'ARABIC_AND_IAU' && visualMagnitude <= 1.0;
}

/** Facts for the star information card. */
export function starDetails(sky: SkyViewV1, index: number) {
  const id = sky.stars.ids[index] ?? '';
  const names = sky.starNames.filter((name) => name.starIndex === index);
  const figures = sky.cultures.flatMap((culture) =>
    culture.figures
      .filter((figure) => figure.memberIndices.includes(index))
      .map((figure) => ({ culture: culture.title, name: figure.name, labels: figure.labels })),
  );
  return {
    id,
    hip: /^hip-(\d+)$/.exec(id)?.[1] ?? null,
    names,
    figures,
    magnitude: sky.stars.visualMagnitudes[index] ?? null,
    colorIndex: sky.stars.colorIndices[index] ?? null,
    enu: [sky.stars.enu[index * 3], sky.stars.enu[index * 3 + 1], sky.stars.enu[index * 3 + 2]] as [
      number,
      number,
      number,
    ],
  };
}
