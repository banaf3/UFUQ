import { describe, expect, it } from 'vitest';

import type { SkyFigureV2, SkyViewV2 } from '@ufuq/contracts';

import { meanDirection, type Vec3 } from '../sky/projection.js';
import type { SkyCanvasStar } from '../sky/sky-types.js';
import {
  CHILD_FIGURE_MAX_FOV,
  figurePlacement,
  figureDetails,
  findOptions,
  foldName,
  matchFind,
  nameFovLimit,
  nearestOnArc,
  skyLayers,
  skyStars,
  starDetails,
} from './sky-layers.js';

const DEG = Math.PI / 180;

const figure = (overrides: Partial<SkyFigureV2> & Pick<SkyFigureV2, 'figureId'>): SkyFigureV2 => ({
  parentId: null,
  arabic: 'الأسد',
  transliteration: 'Al-Asad',
  alternativeNames: [],
  style: 'FIGURE',
  segments: [],
  memberIndices: [],
  evidence: 'PRIMARY_TEXT_READ',
  about: null,
  references: [],
  notes: [],
  conflicts: [],
  sources: [],
  ...overrides,
});

// A tiny fixture: four stars, a figure with a smaller figure inside it, and a group.
const sky: SkyViewV2 = {
  contractVersion: 'sky.v2',
  datasetId: 'test',
  executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
  utc: '2026-01-01T00:00:00Z',
  scenarioId: null,
  observer: { label: 'Test', latitudeDegrees: 0, longitudeDegrees: 0 },
  stars: {
    count: 4,
    ids: ['hip-1', 'hip-2', 'hip-3', 'hip-4'],
    enu: [0, 1, 0.1, 0.1, 1, 0.1, 0.2, 1, 0.2, 0.3, 1, 0.1],
    visualMagnitudes: [1.0, 2.5, 4.0, 5.5],
    colorIndices: [0.5, null, 1.2, 0.0],
  },
  culture: {
    cultureId: 'test-culture',
    title: 'Test',
    layer: 'OLD_ARABIAN',
    reviewState: 'REVIEW_REQUIRED',
    attribution: 'test',
    lineRule: 'Lines: test compilation, unmodified.',
    figures: [
      figure({
        figureId: 'anwa-parent',
        segments: [
          [0, 1],
          [1, 2],
        ],
        memberIndices: [0, 1, 2],
      }),
      figure({
        figureId: 'anwa-child',
        parentId: 'anwa-parent',
        arabic: 'الجبهة',
        transliteration: 'Al-Jabha',
        segments: [[0, 1]],
        memberIndices: [0, 1],
      }),
      figure({
        figureId: 'anwa-group',
        arabic: 'الظباء',
        transliteration: 'Al-Ziba',
        style: 'GROUP',
        segments: [[2, 3]],
        memberIndices: [2, 3],
      }),
    ],
  },
  arabicNames: [
    {
      starIndex: 0,
      arabic: 'القلب',
      transliteration: 'Al-Qalb',
      alternativeNames: [],
      labelOnSky: true,
      evidence: 'PRIMARY_TEXT_READ',
      about: 'The heart of the scorpion.',
      references: [{ title: 'Ibn Qutayba, Kitab al-Anwa', detail: '§83' }],
      notes: [{ text: 'The red star.', source: 'Ibn Qutayba, §83' }],
      conflicts: [],
      sources: [],
    },
    {
      starIndex: 1,
      arabic: 'الفرقدان',
      transliteration: 'Al-Farqadan',
      alternativeNames: [],
      labelOnSky: false,
      evidence: 'NAMED_WITH_FIGURE',
      about: null,
      references: [],
      notes: [],
      conflicts: [],
      sources: [],
    },
  ],
  modernNames: [
    {
      starIndex: 0,
      name: 'Antares',
      designation: 'α Sco',
      language: 'Greek',
      arabicScript: null,
      origin: 'Greek.',
    },
  ],
  provenance: {
    profileId: 'test',
    displayPolicyId: 'SKY_DISPLAY_POLICY_V1',
    scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
    artifacts: [],
    omittedStarCount: 0,
    notices: [],
    attributions: [],
  },
};
const stars = skyStars(sky);

describe('sky layers (Arabic anwāʾ culture only)', () => {
  it('draws each shared segment once and the group faintly', () => {
    const { lines } = skyLayers(sky, stars, { showLines: true, showNames: false });
    expect(lines).toHaveLength(3); // 0-1 (parent and child), 1-2, 2-3
    const group = lines.find((line) => line.dash !== undefined);
    expect(group?.color).toBe('rgba(78, 116, 196, 0.4)');
    expect(lines.filter((line) => line.dash === undefined)).toHaveLength(2);
  });

  it('draws blue lines that stop short of each star by its brightness', () => {
    const { lines } = skyLayers(sky, stars, { showLines: true, showNames: false });
    for (const line of lines) expect(line.color.startsWith('rgba(78, 116, 196, ')).toBe(true);
    // The segment 0-1 joins magnitudes 1.0 and 2.5, so each end gets its own gap.
    expect(lines[0]?.endMagnitudes).toEqual([1.0, 2.5]);
  });

  it('highlights the selected figure with its children', () => {
    const { lines } = skyLayers(sky, stars, {
      showLines: true,
      showNames: false,
      selectedFigureId: 'anwa-parent',
    });
    expect(lines.filter((line) => line.width === 1.8)).toHaveLength(2);
  });

  it('labels figures and unique star names in Arabic with the transliteration under it', () => {
    const { labels } = skyLayers(sky, stars, { showLines: false, showNames: true });
    const texts = labels.map((label) => label.text);
    expect(texts).toEqual(['الأسد', 'الجبهة', 'الظباء', 'القلب']);
    expect(labels.find((l) => l.text === 'القلب')).toMatchObject({
      id: 'star:0',
      secondary: 'Al-Qalb',
    });
    // Coloured names; Arabic and transliteration in Tajawal at one weight (neither bold).
    for (const label of labels) {
      expect(label.color.startsWith('rgb(')).toBe(true);
      expect(label.font.startsWith('500 ')).toBe(true);
      expect(label.font).toContain("'Tajawal'");
      expect(label.secondaryFont?.startsWith('500 ')).toBe(true);
      expect(label.secondaryFont).toContain("'Tajawal'");
    }
    // A shared pair name (al-Farqadan) is drawn by its figure, not on each star.
    expect(texts).not.toContain('الفرقدان');
    // Modern names are never drawn on the sky.
    expect(texts).not.toContain('Antares');
    const child = labels.find((l) => l.id === 'figure:anwa-child');
    const parent = labels.find((l) => l.id === 'figure:anwa-parent');
    const star = labels.find((l) => l.id === 'star:0');
    expect(child?.maxFov).toBe(CHILD_FIGURE_MAX_FOV);
    expect(parent?.maxFov).toBeUndefined();
    // A figure inside a larger one is named at the star-name size, a little darker.
    expect(child?.font).toBe(star?.font);
    expect(child?.secondaryFont).toBe(star?.secondaryFont);
    expect(parent?.font).toContain(' 16px ');
    expect(child?.color).not.toBe(parent?.color);
  });

  it('ranks whole figures first, compact ones before spread ones', () => {
    const { labels } = skyLayers(sky, stars, { showLines: false, showNames: true });
    const rank = (id: string) => labels.find((l) => l.id === id)?.priority ?? NaN;
    // whole figure < group (dashed) < the figure inside the parent < star names
    expect(rank('figure:anwa-parent')).toBeLessThan(rank('figure:anwa-group'));
    expect(rank('figure:anwa-group')).toBeLessThan(rank('figure:anwa-child'));
    expect(rank('figure:anwa-child')).toBeLessThan(rank('star:0'));
    // A compact figure's name has one natural place, so it is placed before a spread one,
    // which can move along its own lines.
    const spread = figure({ figureId: 'spread', memberIndices: [0, 1, 2, 3] });
    const compact = figure({ figureId: 'compact', memberIndices: [0, 1] });
    const both = skyLayers(
      { ...sky, culture: { ...sky.culture!, figures: [spread, compact] } },
      stars,
      { showLines: false, showNames: true },
    ).labels;
    const priority = (id: string) => both.find((l) => l.id === `figure:${id}`)?.priority ?? NaN;
    expect(priority('compact')).toBeLessThan(priority('spread'));
    expect(priority('spread')).toBeLessThan(0.5); // still a whole figure, before groups
  });

  it('puts a figure name on its own lines, not in the empty sky between them', () => {
    // A wide V: the centre of its stars lies inside the V, away from both lines.
    const unit = (e: number, n: number, u: number): Vec3 => {
      const l = Math.hypot(e, n, u);
      return [e / l, n / l, u / l];
    };
    const wide: SkyCanvasStar[] = [unit(-0.5, 1, 0.5), unit(0, 1, 0), unit(0.5, 1, 0.5)].map(
      (enu) => ({ enu, magnitude: 2, colorIndexBV: null }),
    );
    const lines: [number, number][] = [
      [0, 1],
      [1, 2],
    ];
    const vee = figure({ figureId: 'vee', memberIndices: [0, 1, 2], segments: lines });
    const placement = figurePlacement(vee, wide)!;
    const centre = meanDirection(wide.map((s) => s.enu))!;
    const separation = (a: Vec3, b: Vec3) =>
      Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const onLine = (p: Vec3, [i, j]: [number, number]) =>
      Math.abs(
        separation(p, wide[i]!.enu) +
          separation(p, wide[j]!.enu) -
          separation(wide[i]!.enu, wide[j]!.enu),
      ) < 1e-9;
    // Every place offered is on one of the lines, the best one first.
    expect(placement.anchors.length).toBeGreaterThan(0);
    for (const p of placement.anchors) expect(lines.some((line) => onLine(p, line))).toBe(true);
    const best = placement.anchors[0]!;
    expect(separation(best, centre)).toBeGreaterThan(5 * DEG); // the centre is off the lines
    // No point of either line is nearer to the centre than the first place.
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      for (const [i, j] of lines) {
        const a = wide[i]!.enu;
        const b = wide[j]!.enu;
        const p = unit(
          a[0] * (1 - t) + b[0] * t,
          a[1] * (1 - t) + b[1] * t,
          a[2] * (1 - t) + b[2] * t,
        );
        expect(separation(best, centre)).toBeLessThanOrEqual(separation(p, centre) + 1e-12);
      }
    // The spread is the widest star from the centre: an arm's end, not the tip.
    expect(placement.spread).toBeCloseTo(separation(wide[0]!.enu, centre), 12);
    // Without lines, the places are the member stars, nearest the centre first.
    expect(figurePlacement({ ...vee, segments: [] }, wide)?.anchors[0]).toEqual(wide[1]!.enu);
    // The label offers the further places to the renderer.
    const label = skyLayers({ ...sky, culture: { ...sky.culture!, figures: [vee] } }, wide, {
      showLines: false,
      showNames: true,
    }).labels.find((l) => l.id === 'figure:vee');
    expect(label?.direction).toEqual(best);
    expect(label?.alternatives).toEqual(placement.anchors.slice(1));
  });

  it('finds the nearest point of an arc, or its nearer end', () => {
    const a: [number, number, number] = [1, 0, 0];
    const b: [number, number, number] = [0, 1, 0];
    const mid = nearestOnArc(
      a,
      b,
      [Math.SQRT1_2, Math.SQRT1_2, 1].map((x) => x / Math.hypot(Math.SQRT1_2, Math.SQRT1_2, 1)) as [
        number,
        number,
        number,
      ],
    );
    expect(mid[0]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(mid[1]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(mid[2]).toBeCloseTo(0, 12);
    // A point beyond the end a projects outside the arc, so the end itself is nearest.
    expect(nearestOnArc(a, b, [Math.SQRT1_2, -Math.SQRT1_2, 0])).toEqual(a);
  });

  it('hides lines and names independently', () => {
    expect(skyLayers(sky, stars, { showLines: false, showNames: false })).toEqual({
      lines: [],
      labels: [],
    });
  });

  it('reveals fainter star names only as the view narrows', () => {
    expect(nameFovLimit(0.5)).toBeGreaterThan(300 * DEG);
    expect(nameFovLimit(4)).toBeCloseTo(60 * DEG, 5);
    expect(nameFovLimit(6.5)).toBeCloseTo(30 * DEG, 5);
  });
});

describe('information cards', () => {
  it('puts the Arabic name first and keeps the modern name as origin information', () => {
    const details = starDetails(sky, 0);
    expect(details.arabic?.transliteration).toBe('Al-Qalb');
    expect(details.arabic?.about).toBe('The heart of the scorpion.');
    expect(details.modern?.name).toBe('Antares');
    expect(details.hip).toBe('1');
    // Smallest figure first; no IAU constellation is listed.
    expect(details.figures.map((f) => f.figureId)).toEqual(['anwa-child', 'anwa-parent']);
  });

  it('gives a star without an Arabic name no Arabic record', () => {
    const details = starDetails(sky, 3);
    expect(details.arabic).toBeNull();
    expect(details.figures.map((f) => f.figureId)).toEqual(['anwa-group']);
  });

  it('describes a figure with its parent, children and named members', () => {
    const parent = figureDetails(sky, 'anwa-parent');
    expect(parent?.children.map((f) => f.figureId)).toEqual(['anwa-child']);
    expect(parent?.members[0]).toMatchObject({ index: 0 });
    expect(parent?.members[0]?.name?.arabic).toBe('القلب');
    expect(figureDetails(sky, 'anwa-child')?.parent?.figureId).toBe('anwa-parent');
    expect(figureDetails(sky, 'missing')).toBeNull();
  });

  it('finds by transliteration, Arabic script or modern name', () => {
    const options = findOptions(sky);
    expect(matchFind(options, 'al-jabha')?.figureId).toBe('anwa-child');
    // Plain typing works: no hyphen, apostrophe or diacritic needed.
    expect(matchFind(options, 'alziba')?.figureId).toBe('anwa-group');
    expect(matchFind(options, 'Al Qalb')?.indices).toEqual([0]);
    expect(matchFind(options, 'القلب')?.indices).toEqual([0]);
    expect(matchFind(options, 'antares')?.indices).toEqual([0]);
    expect(matchFind(options, 'nothing')).toBeNull();
  });

  it('folds Latin diacritics, ayn and hamza marks and Arabic vowel marks', () => {
    expect(foldName('Banāt Naʿsh')).toBe(foldName("Banat Na'sh"));
    expect(foldName('Banat Nash')).toBe(foldName("Banat Na'sh"));
    expect(foldName('الجَدْي')).toBe(foldName('الجدي'));
    expect(foldName('أدحي')).toBe(foldName('ادحي'));
  });
});
