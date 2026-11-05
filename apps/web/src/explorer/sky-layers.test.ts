import { describe, expect, it } from 'vitest';

import type { SkyFigureV2, SkyViewV2 } from '@ufuq/contracts';

import {
  CHILD_FIGURE_MAX_FOV,
  figureDetails,
  findOptions,
  matchFind,
  nameFovLimit,
  skyLayers,
  skyStars,
  starDetails,
} from './sky-layers.js';

const DEG = Math.PI / 180;

const figure = (overrides: Partial<SkyFigureV2> & Pick<SkyFigureV2, 'figureId'>): SkyFigureV2 => ({
  parentId: null,
  arabic: 'الأسد',
  transliteration: 'al-Asad',
  alternativeNames: [],
  style: 'FIGURE',
  segments: [],
  memberIndices: [],
  evidence: 'PRIMARY_TEXT_READ',
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
    lineRule: 'UFUQ_TREE_V1',
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
        transliteration: 'al-Jabha',
        segments: [[0, 1]],
        memberIndices: [0, 1],
      }),
      figure({
        figureId: 'anwa-group',
        arabic: 'الظباء',
        transliteration: 'al-Ẓibāʾ',
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
      transliteration: 'al-Qalb',
      alternativeNames: [],
      labelOnSky: true,
      evidence: 'PRIMARY_TEXT_READ',
      notes: [{ text: 'The red star.', source: 'Ibn Qutayba, §83' }],
      conflicts: [],
      sources: [],
    },
    {
      starIndex: 1,
      arabic: 'الفرقدان',
      transliteration: 'al-Farqadān',
      alternativeNames: [],
      labelOnSky: false,
      evidence: 'NAMED_WITH_FIGURE',
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
    expect(group?.color).toMatch(/0\.45\)$/);
    expect(lines.filter((line) => line.dash === undefined)).toHaveLength(2);
  });

  it('highlights the selected figure with its children', () => {
    const { lines } = skyLayers(sky, stars, {
      showLines: true,
      showNames: false,
      selectedFigureId: 'anwa-parent',
    });
    expect(lines.filter((line) => line.width === 2.6)).toHaveLength(2);
  });

  it('labels figures and unique star names in Arabic with the transliteration under it', () => {
    const { labels } = skyLayers(sky, stars, { showLines: false, showNames: true });
    const texts = labels.map((label) => label.text);
    expect(texts).toEqual(['الأسد', 'الجبهة', 'الظباء', 'القلب']);
    expect(labels.find((l) => l.text === 'القلب')).toMatchObject({
      id: 'star:0',
      secondary: 'al-Qalb',
    });
    // A shared pair name (al-Farqadān) is drawn by its figure, not on each star.
    expect(texts).not.toContain('الفرقدان');
    // Modern names are never drawn on the sky.
    expect(texts).not.toContain('Antares');
    const child = labels.find((l) => l.id === 'figure:anwa-child');
    expect(child?.maxFov).toBe(CHILD_FIGURE_MAX_FOV);
    expect(labels.find((l) => l.id === 'figure:anwa-parent')?.maxFov).toBeUndefined();
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
    expect(details.arabic?.transliteration).toBe('al-Qalb');
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
    expect(matchFind(options, 'القلب')?.indices).toEqual([0]);
    expect(matchFind(options, 'antares')?.indices).toEqual([0]);
    expect(matchFind(options, 'nothing')).toBeNull();
  });
});
